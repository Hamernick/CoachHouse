// Synthetic saved evidence only; actual source popovers, no source calls.
import "@/app/globals.css"
import { createRoot } from "react-dom/client"
import { ResearchSources } from "@/features/workspace-ai/components/research-sources"
import type { ResearchSource } from "@/features/workspace-ai/research-types"
const base: ResearchSource = { id: "person:known", title: "Jordan", href: "/workspace", revision: "1", checkedAt: "2026-11-02T00:00:00.000Z", kind: "workspace",
  evidence: { version: 1, coverage: "complete", scope: "record", checkedAt: "2026-11-02T00:00:00.000Z", readAt: "2026-11-02T00:00:00.000Z", characters: 80, contactFields: ["email", "details.organization"] } }
const legacy: ResearchSource = { ...base, id: "person:legacy", title: "Legacy contact", evidence: { ...base.evidence!, contactFields: undefined } }
const table: ResearchSource = { ...base, id:"particle:00000000-0000-4000-8000-000000000002",title:"Board finance",evidence:{...base.evidence!,contactFields:undefined,
  tableAnalysis:{request:{id:"particle:00000000-0000-4000-8000-000000000002",budgetColumn:"budget",actualColumn:"actual",currencyColumn:"currency",periodColumn:"period",currency:"USD",amountUnit:"major",period:"2026-10"},
    viewId:"00000000-0000-4000-8000-000000000003",tableId:"00000000-0000-4000-8000-000000000004",viewRevision:2,sourceRevision:"a".repeat(64),filter:{column:"program",value:"Pantry"},filterOperator:"case_insensitive_contains",selectedRows:30,matchedRows:20,complete:true,amountUnit:"major",scale:2}}}
const sheet: ResearchSource = {...table,id:"particle:00000000-0000-4000-8000-000000000005",title:"Linked Sheet finance",evidence:{...table.evidence!,tableAnalysis:{...table.evidence!.tableAnalysis!,tableId:null,
  request:{...table.evidence!.tableAnalysis!.request,id:"particle:00000000-0000-4000-8000-000000000005"},
  sheet:{range:{spreadsheetId:"isolated-sheet-fixture",sheetId:7,startRow:3,rowCount:51,startColumn:2,columnCount:5},title:"Board financial statements",sheetTitle:"Actuals",sourceRevision:"b".repeat(64),providerVersion:"41",rangeRows:50,blankRows:2,filterBasis:"formatted_values",hiddenRows:"included"}}}}
const csv: ResearchSource = {...table,id:"file:00000000-0000-4000-8000-000000000080",title:"Uploaded CSV finance",evidence:{...table.evidence!,tableAnalysis:{...table.evidence!.tableAnalysis!,viewId:null,tableId:null,viewRevision:null,filter:null,selectedRows:30,
  request:{...table.evidence!.tableAnalysis!.request,id:"file:00000000-0000-4000-8000-000000000080"},
  csv:{fileId:"00000000-0000-4000-8000-000000000080",revision:"2026-11-11T00:00:00.000Z",contentHash:"c".repeat(64),byteLength:3456,encoding:"utf-8",delimiter:",",headerRows:1,dataRows:30,columns:[{key:"budget",label:"Budget"},{key:"actual",label:"Actual"},{key:"currency",label:"Currency"},{key:"period",label:"Month"}]}}}}
const comparison: ResearchSource = {...csv,id:"file:00000000-0000-4000-8000-000000000081",title:"Monthly comparison",evidence:{...csv.evidence!,tableAnalysis:{...csv.evidence!.tableAnalysis!,comparisonMatchedRows:10,
  request:{...csv.evidence!.tableAnalysis!.request,id:"file:00000000-0000-4000-8000-000000000081",compareToPeriod:"2026-09"},csv:{...csv.evidence!.tableAnalysis!.csv!,fileId:"00000000-0000-4000-8000-000000000081"}}}}
const grouped: ResearchSource = {...table,id:"particle:00000000-0000-4000-8000-000000000082",title:"Grouped finance",evidence:{...table.evidence!,tableAnalysis:{...table.evidence!.tableAnalysis!,
 request:{...table.evidence!.tableAnalysis!.request,id:"particle:00000000-0000-4000-8000-000000000082",groupByColumn:"program"},groups:[{label:"Pantry",matchedRows:12},{label:"pantry",matchedRows:8}]}}}
const pdf:ResearchSource={...base,id:"file:00000000-0000-4000-8000-000000000083",title:"Board packet PDF",file:{size:12000,format:"pdf"},evidence:{version:1,coverage:"excerpt",scope:"text",checkedAt:base.checkedAt,readAt:base.checkedAt,characters:10,
 textCoverage:{availableCharacters:100,totalCharacters:null,complete:false,ranges:[{start:20,end:30}]},pdf:{totalPages:90,startPage:41,processedPages:40,pages:[42,43],unreadPages:[44,45],priorWindows:[{totalPages:90,startPage:1,processedPages:40,pages:[2],unreadPages:[],textCoverage:{availableCharacters:100,totalCharacters:null,complete:false,ranges:[{start:0,end:10}]}}]}}}
createRoot(document.getElementById("root")!).render(<main><ResearchSources sources={[base, legacy, table, sheet, csv, comparison, grouped, pdf]} /></main>)
