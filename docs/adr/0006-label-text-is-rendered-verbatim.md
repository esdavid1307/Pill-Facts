# Label text is rendered verbatim; no LLM summarization

FDA label prose is written for clinicians, runs to thousands of words, and is littered
with section numbers and dangling cross-references. Summarizing it into plain language
with an LLM is the obvious product improvement and we will not do it.

Paraphrasing a regulated safety document makes us the author of medical content
published under a real person's name, and it silently breaks Provenance: the page would
cite the FDA for words the FDA never wrote. We render verbatim, with cleanup limited to
stripping leading section numbers and unresolvable "[see Warnings and Precautions (5.1)]"
references.

Where plain language is genuinely wanted, the FDA already writes it — the
`information_for_patients` section — and we render that instead.
