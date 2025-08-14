/**
 * Calcula la similitud coseno entre dos vectores
 * @param vecA Primer vector
 * @param vecB Segundo vector
 * @returns Similitud coseno (0-1, donde 1 es idéntico)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    throw new Error('Los vectores deben tener la misma longitud');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

/**
 * Encuentra los top-k elementos más similares
 * @param queryVector Vector de consulta
 * @param vectors Array de vectores a comparar
 * @param k Número de elementos a retornar
 * @returns Array de índices ordenados por similitud
 */
export function findTopKSimilar(
  queryVector: number[],
  vectors: number[][],
  k: number = 5
): Array<{ index: number; score: number }> {
  const similarities = vectors.map((vector, index) => ({
    index,
    score: cosineSimilarity(queryVector, vector),
  }));
  
  // Ordenar por score descendente y retornar top-k
  return similarities
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/**
 * Normaliza un vector a longitud unitaria
 * @param vector Vector a normalizar
 * @returns Vector normalizado
 */
export function normalizeVector(vector: number[]): number[] {
  // Validar que el vector exista y sea un array
  if (!vector || !Array.isArray(vector)) {
    console.warn('Vector inválido recibido en normalizeVector:', vector);
    return [];
  }
  
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vector;
  
  return vector.map(val => val / magnitude);
}
