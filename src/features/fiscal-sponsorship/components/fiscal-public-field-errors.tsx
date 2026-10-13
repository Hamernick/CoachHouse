"use client"
import { createContext, useContext } from "react"
export const FiscalFieldErrors = createContext<Record<string, string>>({})
export function useFiscalFieldError(field?: string) { return useContext(FiscalFieldErrors)[field ?? ""] }
export function FiscalFieldError({ field, id }: { field: string; id?: string }) {
  const message = useFiscalFieldError(field)
  return message ? <p id={id} className="text-xs text-destructive">{message}</p> : null
}
