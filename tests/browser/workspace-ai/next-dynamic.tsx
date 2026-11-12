// These tests open the real upload document editor, not the lazy core editor.
export default function dynamic() {
  return function UnusedLazyEditor() { throw new Error("Lazy core editor outside this controlled fixture") }
}
