function normalizePair(first, second) {
  return first < second ? [first, second] : [second, first];
}

function evenParticipantPairOrder(participantCount) {
  const openingPairs = [
    [0, 2],
    [1, 3],
    ...Array.from({ length: participantCount / 2 - 2 }, (_, index) => [
      4 + index * 2,
      5 + index * 2,
    ]),
  ];
  let rotation = [
    ...openingPairs.map(([first]) => first),
    ...openingPairs.map(([, second]) => second).reverse(),
  ];
  const pairOrder = [];

  for (let round = 0; round < participantCount - 1; round += 1) {
    for (let index = 0; index < participantCount / 2; index += 1) {
      pairOrder.push(
        normalizePair(rotation[index], rotation[participantCount - index - 1]),
      );
    }
    rotation = [rotation[0], rotation.at(-1), ...rotation.slice(1, -1)];
  }

  return pairOrder;
}

function modulo(value, modulus) {
  return ((value % modulus) + modulus) % modulus;
}

function canonicalWaleckiCycles(participantCount) {
  const cycleCount = (participantCount - 1) / 2;
  const rotatingVertexCount = participantCount - 1;
  const fixedVertex = participantCount - 1;

  return Array.from({ length: cycleCount }, (_, cycleIndex) => {
    const cycle = [fixedVertex, cycleIndex];
    for (let offsetIndex = 1; cycle.length < participantCount; offsetIndex += 1) {
      const magnitude = Math.ceil(offsetIndex / 2);
      const direction = offsetIndex % 2 === 1 ? -1 : 1;
      cycle.push(
        modulo(cycleIndex + direction * magnitude, rotatingVertexCount),
      );
    }
    return cycle;
  });
}

function oddParticipantPairOrder(participantCount) {
  const cycles = canonicalWaleckiCycles(participantCount);
  const desiredOpeningCycle =
    participantCount === 5
      ? [2, 0, 1, 3, 4]
      : [
          0,
          2,
          1,
          3,
          ...Array.from({ length: participantCount - 4 }, (_, index) => index + 4),
        ];
  const vertexMap = new Map(
    cycles[0].map((vertex, index) => [vertex, desiredOpeningCycle[index]]),
  );
  const pairOrder = [];

  for (const canonicalCycle of cycles) {
    const cycle = canonicalCycle.map((vertex) => vertexMap.get(vertex));

    // Disjoint alternating edges keep every prefix within one role exposure.
    for (let index = 0; index < participantCount - 1; index += 2) {
      pairOrder.push(normalizePair(cycle[index], cycle[index + 1]));
    }
    pairOrder.push(normalizePair(cycle.at(-1), cycle[0]));
    for (let index = 1; index < participantCount - 1; index += 2) {
      pairOrder.push(normalizePair(cycle[index], cycle[index + 1]));
    }
  }

  return pairOrder;
}

export function buildWolfSeatSchedule(participantCount, trials) {
  const pairOrder =
    participantCount % 2 === 0
      ? evenParticipantPairOrder(participantCount)
      : oddParticipantPairOrder(participantCount);

  return Array.from({ length: trials }, (_, gameIndex) => [
    ...pairOrder[gameIndex % pairOrder.length],
  ]);
}
