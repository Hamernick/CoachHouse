"use client"

import { useCallback,useEffect,useMemo,useRef,useState,type Dispatch,type RefObject,type SetStateAction,type TransitionStartFunction } from "react"
import { saveRoadmapSectionAction } from "@/actions/roadmap"
import type { AiDocumentApplication } from "@/features/workspace-ai/client"
import type { RoadmapSection, RoadmapSectionStatus } from "@/lib/roadmap"
import { hasMeaningfulRoadmapBudgetRows } from "@/lib/roadmap/budget"
import { toast } from "@/lib/toast"
import type { RoadmapDraft,RoadmapEditorProps } from "../types"
import { createDraft,isRoadmapDraftDirty } from "../helpers"
import { acknowledgeRoadmapDraftSave } from "../save-acknowledgment"

export type RoadmapSaveConflict = { section?:RoadmapSection; application?:AiDocumentApplication }

export function useRoadmapSave({sourceScope,canEdit,isPending,savingId,sectionsRef,draftsRef,setSections,setDrafts,setSavingId,setAiApplication,startTransition}: {
  sourceScope:RoadmapEditorProps["sourceScope"]; canEdit:boolean; isPending:boolean; savingId:string | null
  sectionsRef:RefObject<RoadmapSection[]>; draftsRef:RefObject<Record<string,RoadmapDraft>>
  setSections:Dispatch<SetStateAction<RoadmapSection[]>>; setDrafts:Dispatch<SetStateAction<Record<string,RoadmapDraft>>>
  setSavingId:Dispatch<SetStateAction<string | null>>; setAiApplication:Dispatch<SetStateAction<AiDocumentApplication | null>>
  startTransition:TransitionStartFunction

}) {
  const scope=useMemo(()=>({userId:sourceScope?.userId,organizationId:sourceScope?.organizationId}),[sourceScope?.userId,sourceScope?.organizationId])
  const currentScope=useRef(scope)
  currentScope.current=scope
  const busy=useRef<object | null>(null)
  const [conflicts,setConflicts]=useState<Record<string,RoadmapSaveConflict>>({})
  const conflictsRef=useRef(conflicts)
  useEffect(()=>{conflictsRef.current={};setConflicts({});setAiApplication(null);setSavingId(null)},[scope,setAiApplication,setSavingId])
  const saveSectionById=useCallback(({sectionId,showToast,status}:{sectionId:string;showToast:boolean;status?:RoadmapSectionStatus})=>{
    if (!canEdit || !sectionId || savingId || isPending || busy.current || conflictsRef.current[sectionId] || currentScope.current !== scope) return
    const section=sectionsRef.current.find(entry=>entry.id===sectionId)
    if (!section) return
    const draft=draftsRef.current[sectionId] ?? createDraft(section)
    if (!status && !isRoadmapDraftDirty(section,draft)) return
    const markInProgress=section.status === "not_started" && (draft.content.trim().length>0 ||
      hasMeaningfulRoadmapBudgetRows(draft.budgetRows) || draft.title.trim().length>0 || draft.subtitle.trim().length>0)
    const operation={}
    busy.current=operation
    setSavingId(section.id)
    startTransition(async()=>{
      try {
        const result=await saveRoadmapSectionAction({expectedOrganizationId:scope.organizationId,expectedUserId:scope.userId,
          aiRunId:draft.aiRunId,reviewedAiRevision:draft.reviewedAiRevision,sectionId:section.id,expectedLastUpdated:draft.lastUpdated,
          title:draft.title,subtitle:draft.subtitle,content:draft.content,
          budgetRows:section.id === "budget" ? draft.budgetRows : undefined,imageUrl:draft.imageUrl,
          status:draft.requiresPrivateSave ? "in_progress" : status ?? (markInProgress ? "in_progress" : undefined),
          ...(draft.requiresPrivateSave ? {isPublic:false} : {}),
        })
        if (currentScope.current !== scope) return
        if ("error" in result) {
          if (result.code === "conflict") {
            conflictsRef.current={...conflictsRef.current,[sectionId]:{section:result.currentSection,application:result.aiApplication}}
            setConflicts(conflictsRef.current)
          } else toast.error(result.error)
          return
        }
        const next=result.section
        sectionsRef.current=sectionsRef.current.map(entry=>entry.id === next.id ? next : entry)
        const current=draftsRef.current[next.id] ?? draft
        draftsRef.current={...draftsRef.current,[next.id]:acknowledgeRoadmapDraftSave(current,draft,next,result.aiReplay)}
        setSections(sectionsRef.current);setDrafts(draftsRef.current)
        if (result.aiApplication) setAiApplication(result.aiApplication)
        if (showToast) toast.success("Section saved")
      } catch {
        if (currentScope.current === scope) toast.error("The roadmap could not save. Your draft is still available; retry or refresh.")
      } finally {
        if (busy.current === operation) busy.current=null
        if (currentScope.current === scope) setSavingId(null)
      }
    })
  },[canEdit,isPending,savingId,scope,sectionsRef,draftsRef,setSections,setDrafts,setSavingId,setAiApplication,startTransition])
  const resolveConflict=useCallback((sectionId:string,choice:"saved" | "reviewed" | "retry")=>{
    if (!canEdit || busy.current || currentScope.current !== scope) return
    const conflict=conflictsRef.current[sectionId]
    if (!conflict) return
    const latest=conflict.section
    const draft=draftsRef.current[sectionId]
    if (choice !== "retry") {
      if (!latest || !draft || (choice === "reviewed" && latest.driveSource)) return
      sectionsRef.current=sectionsRef.current.map(entry=>entry.id===sectionId ? latest : entry)
      draftsRef.current={...draftsRef.current,[sectionId]:choice === "saved" ? createDraft(latest) : {
        ...draft,lastUpdated:latest.lastUpdated,requiresPrivateSave:true,
        aiRunId:conflict.application ? undefined : draft.aiRunId,
        reviewedAiRevision:!conflict.application && draft.aiRunId ? latest.lastUpdated ?? undefined : undefined,
      }}
      setSections(sectionsRef.current);setDrafts(draftsRef.current)
      if (conflict.application) setAiApplication(conflict.application)
    }
    const remaining={...conflictsRef.current};delete remaining[sectionId]
    conflictsRef.current=remaining;setConflicts(remaining)
  },[canEdit,scope,sectionsRef,draftsRef,setSections,setDrafts,setAiApplication])
  return {saveSectionById,conflicts,resolveConflict}
}
