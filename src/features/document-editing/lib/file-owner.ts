import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase"
import type { DocumentSnapshot, DocumentSource } from "../types"
import { createDocumentFileReader } from "./file-reader"

/** Auth is observed before an explicit read, with the server's verified viewer
 * ID checked before exposing the result. No content cache survives an account
 * switch. Reuse browser auth (including SDK refresh when needed); server
 * getUser remains authoritative. No per-transaction session lookup. */
export function createAccountScopedFileReader({source,client,load}: {
  source:DocumentSource;client:SupabaseClient<Database>
  load:(source:DocumentSource)=>Promise<{viewerId:string;snapshot:DocumentSnapshot}>
}) {
  let actor:string|null|undefined
  let observed:string|null|undefined
  let stop:(()=>void)|null=null
  let closed=false
  let initialized:Promise<void>|null=null
  let owners=0
  let releaseVersion=0
  const reader=createDocumentFileReader({source,load:async source=>{
    const result=await load(source)
    if(closed||result.viewerId!==actor||(observed!==undefined&&observed!==actor)){
      lock();throw new Error("The signed-in account changed while this file was opening.")
    }
    return result.snapshot
  }})
  function lock(){if(closed)return;closed=true;reader.lock();stop?.();stop=null}
  function initialize(){
    if(initialized)return initialized
    const auth=client.auth.onAuthStateChange((_event,session)=>{
      if(closed)return
      observed=session?.user.id??null
      if(actor!==undefined&&observed!==actor)lock()
    })
    stop=()=>auth.data.subscription.unsubscribe()
    initialized=client.auth.getSession().then(({data,error})=>{
      if(closed)return
      actor=data.session?.user.id??null
      if(error||!actor||(observed!==undefined&&observed!==actor))lock()
    }).catch(()=>lock())
    return initialized
  }
  return {
    subscribe:reader.subscribe,
    getSnapshot:reader.getSnapshot,
    lock,
    retain(){
      owners++;releaseVersion++
      let released=false
      return()=>{
        if(released)return;released=true;owners--
        const ticket=++releaseVersion
        // Strict Mode's immediate effect replay reacquires this same reader;
        // a real unmount/source change releases it on the next microtask.
        queueMicrotask(()=>{if(!owners&&ticket===releaseVersion){closed=true;stop?.();stop=null;reader.close()}})
      }
    },
    async open(){if(closed)return;await initialize();if(!closed)await reader.open()},
    async retry(){if(closed)return;await initialize();if(!closed)await reader.retry()},
    close(){closed=true;stop?.();stop=null;reader.close()},
  }
}
