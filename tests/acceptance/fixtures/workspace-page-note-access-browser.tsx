import {useState} from "react"
import {createRoot} from "react-dom/client"
import {Button} from "@/components/ui/button"
import {PageAccessManager} from "@/features/workspace-sharing/components/page-access-manager"
import {GuestWorkspacePage} from "@/features/workspace-sharing/components/guest-workspace-page"
import "@/app/globals.css"
function Fixture(){const [guest,setGuest]=useState(window.location.hash==="#guest");return <main className="mx-auto w-full max-w-4xl p-4"><Button onClick={async()=>{await fetch('/fixture-identity',{method:'POST',body:guest?'1':'2'});window.location.hash=guest?"owner":"guest";setGuest(!guest)}}>{guest?'Switch to organization editor':'Switch to invited editor'}</Button>{guest?<GuestWorkspacePage pageId="10000000-0000-4000-8000-000000007000"/>:<PageAccessManager pageId="10000000-0000-4000-8000-000000007000"/>}</main>}
createRoot(document.getElementById("root")!).render(<Fixture/> )
