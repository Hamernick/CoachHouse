export class FormIntakeError extends Error {
  constructor(public readonly status: number, message: string, public readonly uncertain = false) { super(message) }
}
