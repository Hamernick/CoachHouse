import { documentSnapshotSchema, documentSourceSchema } from "./contracts"
import type { DocumentSnapshot, DocumentSource } from "../types"

export type DocumentReadState = {status:"loading"|"ready"|"error"|"locked";snapshot:DocumentSnapshot|null}
/** One explicit-open request per mounted source. Hidden retained panels keep
 * the result; late responses after unmount never replace another file. */
export function createDocumentFileReader({source:input,load}: {
  source:DocumentSource;load:(source:DocumentSource)=>Promise<DocumentSnapshot>
}) {
  const source=documentSourceSchema.parse(input)
  let state:DocumentReadState={status:"loading",snapshot:null}
  let flight:Promise<void>|null=null
  let closed=false
  const listeners=new Set<()=>void>()
  function report(next:DocumentReadState){if(closed)return;state=next;for(const listener of listeners)listener()}
  return {
    subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}},
    getSnapshot:()=>state,
    open(){
      if(closed||flight||state.status==="ready"||state.status==="error")return flight??Promise.resolve()
      report({status:"loading",snapshot:null})
      flight=Promise.resolve().then(()=>load(source)).then(value=>{
        if(closed)return
        const snapshot=documentSnapshotSchema.parse(value)
        if(JSON.stringify(snapshot.source)!==JSON.stringify(source))throw new Error("This response belongs to another document.")
        report({status:"ready",snapshot})
      }).catch(()=>report({status:"error",snapshot:null})).finally(()=>{flight=null})
      return flight
    },
    retry(){if(closed||flight)return flight??Promise.resolve();state={status:"loading",snapshot:null};return this.open()},
    lock(){report({status:"locked",snapshot:null});closed=true;listeners.clear()},
    close(){closed=true;listeners.clear();state={status:"loading",snapshot:null}},
  }
}
