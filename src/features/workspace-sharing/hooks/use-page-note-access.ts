"use client"
import {useCallback,useRef,useState} from "react"
import {workspacePageNoteAction} from "../note-actions"
import type {PageNoteCommand,PageNoteData} from "../lib/page-note-access"
export function usePageNoteAccess(){
 const [data,setData]=useState<PageNoteData|null>(null),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[uncertain,setUncertain]=useState<PageNoteCommand|null>(null)
 const busy=useRef(false),retry=useRef<PageNoteCommand|null>(null)
 const send=useCallback(async(command:PageNoteCommand)=>{
  if(busy.current||(retry.current&&retry.current!==command))return null
  busy.current=true;setPending(true);setError(null)
  try{
   const result=await workspacePageNoteAction(command)
   if(!result.ok){setError(result.error);const unknown=result.uncertain&&["write","set_scope"].includes(command.action);retry.current=unknown?command:null;setUncertain(retry.current);if(result.code==="scope")setData(null);return null}
   retry.current=null;setUncertain(null)
   if(result.signInRequired){setData(null);setError("Sign in with the invited account.");return null}
   setData(result.value);return result.value
  }catch{setError("Unable to confirm. Retry this same request.");if(["write","set_scope"].includes(command.action)){retry.current=command;setUncertain(command)}return null}
  finally{busy.current=false;setPending(false)}
 },[])
 return {data,pending,error,uncertain,send}
}
