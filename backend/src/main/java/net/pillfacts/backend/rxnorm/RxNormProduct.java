package net.pillfacts.backend.rxnorm;

/**
 * One product RxNorm relates to an Active Ingredient, as RxNorm's own normalised name
 * describes it.
 *
 * <p>RxNorm names a product from its parts — every Active Ingredient with its strength,
 * then the dosage form, then the Brand in brackets where it has one — so the name is
 * already the statement of composition an Alternative is allowed to be (ADR-0005), and
 * is carried here as RxNorm wrote it.
 *
 * @param rxcui the product's own RxCUI, which is not a Drug Concept's and addresses no
 * page here
 * @param composition the name less the Brand: the Active Ingredients, their strengths
 * and the dosage form
 * @param brand the Brand it is sold under, or null for a product RxNorm names without
 * one
 * @param combinationProduct whether the composition names more than one Active
 * Ingredient
 */
public record RxNormProduct(String rxcui, String composition, String brand, boolean combinationProduct) {}
