# Alternatives are a statement of composition, never of substitutability

"Find generic alternatives" was an original V1 feature, and it is the most legally
exposed thing this product does. An Alternative in Pill-Facts means only: another
product with the same single Active Ingredient, the same strength, and the same dosage
form. It is never a claim that a reader may switch to it.

Real therapeutic equivalence requires the FDA Orange Book's TE codes, a separate dataset
we deliberately do not use, and has no clean Canadian counterpart. Presenting anything
weaker as equivalence would be authoring clinical advice.

## Consequences

The wording is enforced in the UI, not in a footer disclaimer — no rendered sentence may
be readable as "you can take this instead". Combination Products are filtered out of
Alternatives entirely and shown in their own labelled section: RxNorm lists Caduet
(amlodipine + atorvastatin) as a brand of atorvastatin, and offering a blood-pressure
combination as an alternative to a statin is the most dangerous false positive available
to us.
