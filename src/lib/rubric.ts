/** Used for oral defenses when a track has no rubric of its own (Special Technician Edition 4 rubric). */
export const DEFAULT_RUBRIC = [
  { criterion: "Architecture reasoning", levels: ["Can't say why", "Names choices", "Justifies with trade-offs", "Compares alternatives with numbers"] },
  { criterion: "Fundamentals", levels: ["Gaps on basics", "Recites definitions", "Explains the mechanism", "Derives it on the board"] },
  { criterion: "Evidence", levels: ["Demo only", "Some metrics", "Eval suite and baselines", "Benchmarks with confidence intervals"] },
  { criterion: "Failure analysis", levels: ["Unaware", "Lists failures", "Explains causes", "Predicts failures under new conditions"] },
  { criterion: "Communication", levels: ["Unclear", "Clear to engineers", "Clear to mixed audience", "Concise, answers the question asked"] },
];
