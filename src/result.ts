// fork form https://yatsbashy.hatenablog.com/entry/typescript-simple-result

export type Result<T = unknown, E = unknown> = Success<T> | Failure<E>

export class Success<T = unknown> {
  readonly isSuccess = true;
  readonly isFailure = false;
  constructor(readonly value: T) {}
}

export class Failure<E = unknown> {
  readonly isSuccess = false;
  readonly isFailure = true;
  constructor(readonly value?: E) {}
}
