import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { readGoogleSheetGrid } from "@/features/google-drive/server/sheets-read"
import { readGoogleSheetRange } from "@/features/google-drive/server/service"
const mocks=vi.hoisted(()=>({single:vi.fn(),eq:vi.fn(),refresh:vi.fn(),file:vi.fn(),decrypt:vi.fn()}))
vi.mock("@/features/google-drive/server/google-api",()=>({refreshGoogleDriveAccessToken:mocks.refresh,getGoogleDriveFile:mocks.file,revokeGoogleDriveToken:vi.fn(),exchangeGoogleDriveCode:vi.fn()}))
vi.mock("@/features/google-drive/server/token-crypto",()=>({decryptGoogleDriveSecret:mocks.decrypt,encryptGoogleDriveSecret:vi.fn()}))
vi.mock("@/lib/supabase/admin",()=>({createSupabaseAdminClient:()=>({from:()=>{const query={select:()=>query,update:()=>query,eq:(...args:unknown[])=>{mocks.eq(...args);return query},maybeSingle:mocks.single};return query}})}))
const range={spreadsheetId:"isolated-sheet-fixture",sheetId:7,startRow:3,rowCount:3,startColumn:2,columnCount:2}
const payload=()=>({spreadsheetId:range.spreadsheetId,properties:{title:"Fixture"},sheets:[{properties:{sheetId:7,title:"Data"},data:[{startRow:2,startColumn:1,rowData:[{values:[{formattedValue:"Name"},{formattedValue:"Total"}]},{values:[{formattedValue:"Current source"},{formattedValue:"42"}]}]}]}]})
const connection={id:"connection-viewer",google_subject:"viewer-subject",google_email:"viewer@example.org",refresh_token_ciphertext:"viewer-cipher",refresh_token_iv:"iv",refresh_token_auth_tag:"tag",key_version:1}
const fetchMock=vi.fn()
beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal("fetch",fetchMock);fetchMock.mockResolvedValue(Response.json(payload()));mocks.single.mockResolvedValue({data:connection,error:null});mocks.refresh.mockResolvedValue("viewer-access");mocks.decrypt.mockReturnValue("viewer-refresh");mocks.file.mockResolvedValue({status:"available",mimeType:"application/vnd.google-apps.spreadsheet"})})
afterEach(()=>vi.unstubAllGlobals())
describe("Google Sheets bounded reads and execution identity",()=>{
 it("requests exactly a numeric sheet/range with formatted read values and no source mutation",async()=>{
  const result=await readGoogleSheetGrid("private-token",range)
  const [url,init]=fetchMock.mock.calls[0]
  expect(String(url)).toContain(":getByDataFilter?");expect(init).toMatchObject({method:"POST",cache:"no-store",redirect:"error",headers:{authorization:"Bearer private-token"}})
  expect(JSON.parse(init.body)).toEqual({dataFilters:[{gridRange:{sheetId:7,startRowIndex:2,endRowIndex:5,startColumnIndex:1,endColumnIndex:3}}],includeGridData:true})
  expect(result.rows[1]).toEqual(["Current source","42"]);expect(JSON.stringify(result)).not.toContain("private-token");expect(result.revision).toMatch(/^[a-f0-9]{64}$/)
 })
 it("selects and refreshes only the current viewer's own Google connection, then rechecks it",async()=>{
  const result=await readGoogleSheetRange("current-viewer",range)
  expect(mocks.eq).toHaveBeenCalledWith("user_id","current-viewer");expect(mocks.eq).not.toHaveBeenCalledWith("user_id","organization-owner")
  expect(mocks.refresh).toHaveBeenCalledWith("viewer-refresh");expect(mocks.file).toHaveBeenCalledWith("viewer-access",range.spreadsheetId)
  expect(mocks.single).toHaveBeenCalledTimes(2);expect(result.email).toBe("viewer@example.org");expect(JSON.stringify(result)).not.toContain("viewer-cipher")
 })
 it("rejects revoked or replaced identity after a provider read",async()=>{
  mocks.single.mockResolvedValueOnce({data:connection,error:null}).mockResolvedValueOnce({data:{...connection,google_subject:"different-subject"},error:null})
  await expect(readGoogleSheetRange("current-viewer",range)).rejects.toMatchObject({code:"google_revoked"})
 })
 it("discards fetched rows if the file is trashed or denied during the read",async()=>{
  mocks.file.mockResolvedValueOnce({status:"available",mimeType:"application/vnd.google-apps.spreadsheet"}).mockResolvedValueOnce({status:"trashed",mimeType:"application/vnd.google-apps.spreadsheet"})
  await expect(readGoogleSheetRange("current-viewer",range)).rejects.toMatchObject({code:"file_not_authorized"})
  expect(mocks.file).toHaveBeenCalledTimes(2)
 })
 it("does not fall back to another identity when the viewer has no connection",async()=>{
  mocks.single.mockResolvedValue({data:null,error:null})
  await expect(readGoogleSheetRange("current-viewer",range)).rejects.toMatchObject({code:"google_revoked"});expect(fetchMock).not.toHaveBeenCalled();expect(mocks.refresh).not.toHaveBeenCalled()
 })
 it.each([401,403,404])("fails closed on provider status %s",async status=>{
  fetchMock.mockResolvedValue(new Response("",{status}));await expect(readGoogleSheetGrid("token",range)).rejects.toMatchObject({code:"file_not_authorized"})
 })
 it("rejects a wrong sheet identity, range offset, oversized body, and malformed cells",async()=>{
  const wrong=payload();wrong.sheets[0].properties.sheetId=8;fetchMock.mockResolvedValue(Response.json(wrong));await expect(readGoogleSheetGrid("token",range)).rejects.toMatchObject({code:"file_not_authorized"})
  const shifted=payload();shifted.sheets[0].data[0].startRow=0;fetchMock.mockResolvedValue(Response.json(shifted));await expect(readGoogleSheetGrid("token",range)).rejects.toMatchObject({code:"file_not_authorized"})
  fetchMock.mockResolvedValue(new Response("x".repeat(1000001)));await expect(readGoogleSheetGrid("token",range)).rejects.toMatchObject({code:"unsupported_preview"})
  const invalid=payload();invalid.sheets[0].data[0].rowData[0].values[0].formattedValue="x".repeat(10001);fetchMock.mockResolvedValue(Response.json(invalid));await expect(readGoogleSheetGrid("token",range)).rejects.toMatchObject({code:"unsupported_preview"})
 })
 it("renders formulas only as provider-formatted text; no write request or formula evaluation exists",async()=>{
  const formula=payload();formula.sheets[0].data[0].rowData[1].values[1].formattedValue="=SAFE TEXT"
  fetchMock.mockResolvedValue(Response.json(formula));expect((await readGoogleSheetGrid("token",range)).rows[1][1]).toBe("=SAFE TEXT")
  expect(fetchMock).toHaveBeenCalledTimes(1)
 })
})
