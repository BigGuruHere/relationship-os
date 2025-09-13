-- Embedding row count
SELECT COUNT(*) AS embeddings FROM "InteractionEmbedding";

-- Vector dimension histogram
SELECT array_length("embedding", 1) AS dim, COUNT(*) 
FROM "InteractionEmbedding"
GROUP BY dim
ORDER BY dim;

-- Interactions per user
SELECT "userId", COUNT(*) AS interactions
FROM "Interaction"
GROUP BY "userId"
ORDER BY interactions DESC;
