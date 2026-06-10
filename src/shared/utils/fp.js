import { pipe, pipeWith } from "ramda";

const asyncPipe = (...fns) =>
  pipeWith((fn, res) => Promise.resolve(res).then(fn))([...fns]);

export { pipe, asyncPipe };
