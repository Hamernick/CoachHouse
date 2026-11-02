"use client"
import { useId } from "react"
import { ParticleButton as Button } from "@/components/ui/particle-ui"
import { ParticleInput as Input } from "@/components/ui/particle-ui"
import { Field, FieldLabel } from "@/components/ui/field"
import { pickGoogleDriveFileReferences } from "@/features/google-drive/client"
import type { GoogleSheetRange } from "@/features/google-drive/client"
export function DataViewSheetSource({value,onChange,disabled,onError}:{value:GoogleSheetRange;onChange:(value:GoogleSheetRange)=>void;disabled:boolean;onError:(message:string)=>void}){
 const instance=useId()
 return <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-3"><legend className="sr-only">Linked Google Sheet range</legend>
  <Button size="lg" color="primary" type="button" variant="outline" onClick={async()=>{try{const files=await pickGoogleDriveFileReferences();if(files[0])onChange({...value,spreadsheetId:files[0].id})}catch{onError("Connect your Google account in Documents, then choose a Sheet you can open.")}}}>Choose from my Google Drive</Button>
  <Field><FieldLabel htmlFor={`${instance}-file`}>Spreadsheet ID</FieldLabel><Input size="2xl" id={`${instance}-file`} value={value.spreadsheetId} autoComplete="off" onChange={event=>onChange({...value,spreadsheetId:event.target.value})}/></Field>
  <div className="grid grid-cols-2 gap-3">{([['sheetId','Sheet tab ID (gid)'],['startRow','Header row'],['rowCount','Rows including header'],['startColumn','First column number'],['columnCount','Column count']] as const).map(([key,label])=><Field key={key}><FieldLabel htmlFor={`${instance}-${key}`}>{label}</FieldLabel><Input size="2xl" id={`${instance}-${key}`} type="number" min={key==='sheetId'?0:key==='rowCount'?2:1} max={key==='rowCount'?501:key==='columnCount'?12:undefined} value={value[key]} onChange={event=>onChange({...value,[key]:Number(event.target.value)})}/></Field>)}</div>
  <p className="text-muted-foreground text-xs">Read a fixed range with at most 500 records and 12 columns. The first row supplies column names. Each viewer needs their own connected Google account and file access. Cells are read-only here; edit the original in Sheets. No rows are copied into Coach House.</p>
 </fieldset>
}
