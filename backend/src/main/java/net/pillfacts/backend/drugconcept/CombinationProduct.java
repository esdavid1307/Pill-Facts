package net.pillfacts.backend.drugconcept;

import java.util.List;

/**
 * A product containing this Drug Concept's Active Ingredient and at least one other.
 *
 * <p>It is a separate type from {@link Alternative} because the one mistake this part of
 * the system exists to prevent is showing one where the other belongs: RxNorm lists
 * Caduet, which is amlodipine as well as atorvastatin, among atorvastatin's brands, and
 * offering a blood-pressure combination as an alternative to a statin is the most
 * dangerous false positive available to us (ADR-0005). Two types mean no list can be
 * handed the wrong one.
 *
 * @param composition RxNorm's own name for the product less its Brand, which names every
 * Active Ingredient in it with its strength
 * @param brands the Brands sold in exactly that composition, in alphabetical order and
 * empty where it is sold without one
 */
public record CombinationProduct(String composition, List<String> brands) {}
