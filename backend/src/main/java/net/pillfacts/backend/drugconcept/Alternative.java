package net.pillfacts.backend.drugconcept;

import java.util.List;

/**
 * Another product with this Drug Concept's Active Ingredient, in one strength and one
 * dosage form.
 *
 * <p>This is a statement about what a product is made of and nothing else. It carries no
 * prose, because ADR-0005 puts the wording in the shape rather than in a disclaimer:
 * there is nothing here a renderer could turn into a sentence about taking one thing
 * instead of another. Strength and dosage form are part of the composition rather than
 * fields of their own, so an Alternative cannot be built that spans two of either.
 *
 * @param composition RxNorm's own name for the product less its Brand: the Active
 * Ingredient, its strength, and the dosage form
 * @param brands the Brands sold in exactly that composition, in alphabetical order and
 * empty where it is sold without one
 */
public record Alternative(String composition, List<String> brands) {}
