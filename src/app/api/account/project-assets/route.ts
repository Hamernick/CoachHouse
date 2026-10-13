import { NextResponse, type NextRequest } from "next/server"

import {
  buildProjectAssetOpenPath,
  detectProjectAssetTypeFromName,
  detectProjectAssetTypeFromUrl,
  sanitizeProjectAssetFilename,
} from "@/features/member-workspace"
import type { Database } from "@/lib/supabase"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route"
import {
  assetResponse,
  canAccessProjectOrg,
  cleanupProjectAssetCreation,
  getProjectAssetFileError,
  getProjectAssetLinkError,
  loadAsset,
  loadProject,
  toTrimmedString,
  type AssetRow,
  PROJECT_ASSET_BUCKET as BUCKET,
} from "./route-support"

const SIGNED_URL_TTL_SECONDS = 60 * 15
const MAX_BYTES = 50 * 1024 * 1024

export async function GET(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(request.url)
  const projectId = toTrimmedString(searchParams.get("projectId"))
  const assetId = toTrimmedString(searchParams.get("assetId"))
  const downloadRequested = searchParams.get("download") === "1"

  if (!projectId || !assetId) {
    return NextResponse.json(
      { error: "Project asset is required." },
      { status: 400 }
    )
  }

  try {
    const asset = await loadAsset({
      assetId,
      projectId,
      supabase,
    })

    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 })
    }

    const canRead = await canAccessProjectOrg({
      projectId,
      orgId: asset.org_id,
      requireEdit: false,
      supabase,
      userId: user.id,
    })
    if (!canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (asset.external_url) {
      return NextResponse.redirect(asset.external_url)
    }

    if (!asset.storage_path) {
      return NextResponse.json(
        { error: "Asset file unavailable." },
        { status: 404 }
      )
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(
        asset.storage_path,
        SIGNED_URL_TTL_SECONDS,
        downloadRequested ? { download: asset.name || true } : undefined
      )

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { error: signedError?.message ?? "Unable to open asset." },
        { status: 500 }
      )
    }

    return NextResponse.redirect(signed.signedUrl)
  } catch (routeError: unknown) {
    return NextResponse.json(
      {
        error:
          routeError instanceof Error
            ? routeError.message
            : "Unable to load asset.",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  const form = await request.formData()
  const projectId = toTrimmedString(form.get("projectId"))
  const title = toTrimmedString(form.get("title"))
  const description = toTrimmedString(form.get("description")) || null
  const link = toTrimmedString(form.get("link"))
  const files = form
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File)

  if (!projectId) {
    return NextResponse.json({ error: "Project is required." }, { status: 400 })
  }

  if (!link && files.length === 0) {
    return NextResponse.json(
      { error: "Add a link or choose at least one file." },
      { status: 400 }
    )
  }

  const linkError = link ? getProjectAssetLinkError(link) : null
  if (linkError) {
    return NextResponse.json({ error: linkError }, { status: 400 })
  }

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${file.name} is too large. Max size is 50 MB.` },
        { status: 400 }
      )
    }
    const fileTypeError = getProjectAssetFileError(file)
    if (fileTypeError) {
      return NextResponse.json({ error: fileTypeError }, { status: 400 })
    }
  }

  const insertedAssets: AssetRow[] = []
  const uploadedPaths: string[] = []

  try {
    const project = await loadProject({
      projectId,
      supabase,
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 })
    }

    const canEdit = await canAccessProjectOrg({
      projectId,
      orgId: project.org_id,
      requireEdit: true,
      supabase,
      userId: user.id,
    })
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (link) {
      const assetName = title || link
      const { data, error: insertError } = await supabase
        .from("organization_project_assets")
        .insert({
          org_id: project.org_id,
          project_id: project.id,
          name: assetName,
          description,
          asset_type: detectProjectAssetTypeFromUrl(link),
          external_url: link,
          created_by: user.id,
          updated_by: user.id,
        })
        .select(
          "id, org_id, project_id, name, description, asset_type, storage_path, external_url, mime, size_bytes"
        )
        .returns<AssetRow[]>()

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }

      insertedAssets.push(...(data ?? []))
    }

    for (const file of files) {
      const objectName = `${project.org_id}/${project.id}/${Date.now()}-${sanitizeProjectAssetFilename(file.name)}`
      const buffer = Buffer.from(await file.arrayBuffer())
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectName, buffer, {
          contentType: file.type || undefined,
        })

      if (uploadError) {
        await cleanupProjectAssetCreation({
          assetIds: insertedAssets.map((asset) => asset.id),
          storagePaths: uploadedPaths,
          supabase,
        })
        return NextResponse.json(
          { error: uploadError.message },
          { status: 500 }
        )
      }

      uploadedPaths.push(objectName)

      const assetName = files.length === 1 && title ? title : file.name
      const { data, error: insertError } = await supabase
        .from("organization_project_assets")
        .insert({
          org_id: project.org_id,
          project_id: project.id,
          name: assetName,
          description,
          asset_type: detectProjectAssetTypeFromName(file.name),
          storage_path: objectName,
          mime: file.type || null,
          size_bytes: file.size,
          created_by: user.id,
          updated_by: user.id,
        })
        .select(
          "id, org_id, project_id, name, description, asset_type, storage_path, external_url, mime, size_bytes"
        )
        .returns<AssetRow[]>()

      if (insertError) {
        await cleanupProjectAssetCreation({
          assetIds: insertedAssets.map((asset) => asset.id),
          storagePaths: uploadedPaths,
          supabase,
        })
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }

      insertedAssets.push(...(data ?? []))
    }

    return NextResponse.json(
      {
        assets: insertedAssets.map(assetResponse),
      },
      { status: 200 }
    )
  } catch (routeError: unknown) {
    await cleanupProjectAssetCreation({
      assetIds: insertedAssets.map((asset) => asset.id),
      storagePaths: uploadedPaths,
      supabase,
    })
    return NextResponse.json(
      {
        error:
          routeError instanceof Error
            ? routeError.message
            : "Unable to save assets.",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  const payload = await request.json().catch(() => null)
  const projectId = toTrimmedString(payload?.projectId)
  const assetId = toTrimmedString(payload?.assetId)
  const name = toTrimmedString(payload?.name)
  const description = toTrimmedString(payload?.description) || null
  const externalUrl = toTrimmedString(payload?.link)

  if (!projectId || !assetId || !name) {
    return NextResponse.json(
      { error: "Asset name is required." },
      { status: 400 }
    )
  }

  const linkError = externalUrl ? getProjectAssetLinkError(externalUrl) : null
  if (linkError) {
    return NextResponse.json({ error: linkError }, { status: 400 })
  }

  try {
    const asset = await loadAsset({
      assetId,
      projectId,
      supabase,
    })

    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 })
    }

    const canEdit = await canAccessProjectOrg({
      projectId,
      orgId: asset.org_id,
      requireEdit: true,
      supabase,
      userId: user.id,
    })
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updatePayload: Database["public"]["Tables"]["organization_project_assets"]["Update"] =
      {
        name,
        description,
        updated_by: user.id,
      }

    if (asset.external_url) {
      const nextLink = externalUrl || asset.external_url
      updatePayload.external_url = nextLink
      updatePayload.asset_type = detectProjectAssetTypeFromUrl(nextLink)
    }

    const { data, error: updateError } = await supabase
      .from("organization_project_assets")
      .update(updatePayload)
      .eq("id", asset.id)
      .eq("project_id", projectId)
      .select(
        "id, org_id, project_id, name, description, asset_type, storage_path, external_url, mime, size_bytes"
      )
      .returns<AssetRow[]>()

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(
      { asset: data?.[0] ? assetResponse(data[0]) : null },
      { status: 200 }
    )
  } catch (routeError: unknown) {
    return NextResponse.json(
      {
        error:
          routeError instanceof Error
            ? routeError.message
            : "Unable to update asset.",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createSupabaseRouteHandlerClient(request, response)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: error?.message ?? "Unauthorized" },
      { status: 401 }
    )
  }

  const payload = await request.json().catch(() => null)
  const projectId = toTrimmedString(payload?.projectId)
  const assetId = toTrimmedString(payload?.assetId)

  if (!projectId || !assetId) {
    return NextResponse.json(
      { error: "Project asset is required." },
      { status: 400 }
    )
  }

  try {
    const asset = await loadAsset({
      assetId,
      projectId,
      supabase,
    })

    if (!asset) {
      return NextResponse.json({ error: "Asset not found." }, { status: 404 })
    }

    const canEdit = await canAccessProjectOrg({
      projectId,
      orgId: asset.org_id,
      requireEdit: true,
      supabase,
      userId: user.id,
    })
    if (!canEdit) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from("organization_project_assets")
      .delete()
      .eq("id", asset.id)
      .eq("project_id", projectId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    if (asset.storage_path) {
      await supabase.storage
        .from(BUCKET)
        .remove([asset.storage_path])
        .catch(() => undefined)
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (routeError: unknown) {
    return NextResponse.json(
      {
        error:
          routeError instanceof Error
            ? routeError.message
            : "Unable to delete asset.",
      },
      { status: 500 }
    )
  }
}
