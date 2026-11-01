export function orthographicViewHeight(aspect) {
  // Weather changes never resize the miniature; narrow viewports keep the
  // full island visible by expanding height as width contracts.
  return aspect < 1.1 ? 21 / aspect : 14.5;
}
