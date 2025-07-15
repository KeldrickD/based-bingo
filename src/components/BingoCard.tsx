'use client'; // Client-side for state

import React, { useState, useEffect } from 'react';
import { useAccount, useConnect } from 'wagmi';

function generateBingoCard() {
  const columnRanges = [
    { label: 'B', min: 1, max: 15 },
    { label: 'I', min: 16, max: 30 },
    { label: 'N', min: 31, max: 45 },
    { label: 'G', min: 46, max: 60 },
    { label: 'O', min: 61, max: 75 },
  ];

  const card: (number | string)[][] = columnRanges.map(({ min, max }) => {
    const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const shuffled = [...nums].sort(() => Math.random() - 0.5).slice(0, 5);
    return shuffled;
  });

  card[2][2] = 'FREE'; // Explicitly set center free space
  return card;
}

function checkWin(marked: Set<string>): boolean {
  const wins = [
    // Rows
    ['00', '01', '02', '03', '04'],
    ['10', '11', '12', '13', '14'],
    ['20', '21', '22', '23', '24'],
    ['30', '31', '32', '33', '34'],
    ['40', '41', '42', '43', '44'],
    // Columns
    ['00', '10', '20', '30', '40'],
    ['01', '11', '21', '31', '41'],
    ['02', '12', '22', '32', '42'],
    ['03', '13', '23', '33', '43'],
    ['04', '14', '24', '34', '44'],
    // Diagonals
    ['00', '11', '22', '33', '44'],
    ['04', '13', '22', '31', '40'],
  ];
  return wins.some((line) => line.every((pos) => marked.has(pos) || pos === '22'));
}

export default function BingoCard() {
  const [card, setCard] = useState<(number | string)[][]>([]);
  const [marked, setMarked] = useState<Set<string>>(new Set(['22'])); // FREE marked by default
  const [currentNumber, setCurrentNumber] = useState<number | null>(null);
  const [drawnNumbers, setDrawnNumbers] = useState<Set<number>>(new Set()); // Track uniques
  const [isWin, setIsWin] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const { address } = useAccount();
  const { connect, connectors } = useConnect();

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = () => {
    const newCard = generateBingoCard();
    setCard(newCard);
    setMarked(new Set(['22']));
    setCurrentNumber(null);
    setDrawnNumbers(new Set());
    setIsWin(false);
    console.log('New Game Started. Card:', newCard);
    console.log('Center (col 2, row 2):', newCard[2][2]); // Debug
  };

  const drawNumber = () => {
    let num: number;
    do {
      num = Math.floor(Math.random() * 75) + 1;
    } while (drawnNumbers.has(num)); // Ensure unique
    setDrawnNumbers((prev) => new Set([...prev, num]));
    setCurrentNumber(num);
  };

  const markCell = (row: number, col: number) => {
    const num = card[col][row];
    if (typeof num === 'number' && num === currentNumber) {
      const pos = `${col}${row}`;
      setMarked((prev) => new Set([...prev, pos]));
    }
  };

  useEffect(() => {
    if (checkWin(marked)) {
      setIsWin(true);
    }
  }, [marked]);

  return (
    <div className="text-center max-w-sm mx-auto"> {/* Responsive container */}
      {!isHydrated ? (
        <div className="mb-4 p-2 text-coinbase-blue">Loading wallet connection...</div>
      ) : (
        <>
          {!address ? (
            <button
              onClick={() => connect({ connector: connectors[0] })} // Coinbase Wallet connector
              className="bg-coinbase-blue text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-600 mb-4"
            >
              Connect Wallet (for future $BINGO wins)
            </button>
          ) : (
            <p className="text-sm text-coinbase-blue mb-4">Connected: {address.slice(0, 6)}...{address.slice(-4)}</p>
          )}
        </>
      )}
      <div className="grid grid-cols-5 gap-1 mb-4">
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div key={letter} className="font-bold text-coinbase-blue text-lg">
            {letter}
          </div>
        ))}
        {Array.from({ length: 5 }).map((_, row) =>
          Array.from({ length: 5 }).map((_, col) => {
            const num = card[col]?.[row] ?? '';
            const pos = `${col}${row}`;
            const isMarked = marked.has(pos) || (num === 'FREE' && pos === '22'); // Visually mark FREE
            return (
              <button
                key={pos}
                onClick={() => markCell(row, col)}
                className={`w-full aspect-square border-2 border-coinbase-blue flex items-center justify-center text-sm font-bold rounded
                  ${isMarked ? 'bg-coinbase-blue text-white' : 'bg-white text-coinbase-blue hover:bg-blue-100'}
                  ${num === 'FREE' ? 'text-xs rotate-[-45deg]' : ''}`}
                disabled={isMarked || (typeof num !== 'number' && num !== 'FREE')}
              >
                {num}
              </button>
            );
          })
        )}
      </div>
      <div className="flex justify-center gap-4 mb-2">
        <button
          onClick={drawNumber}
          className={`px-6 py-2 rounded-lg font-bold transition-all ${
            isWin || drawnNumbers.size >= 75
              ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
              : 'bg-coinbase-blue text-white hover:bg-blue-600'
          }`}
          disabled={isWin || drawnNumbers.size >= 75} // No more draws if won or all drawn
        >
          Draw Number
        </button>
        <button
          onClick={resetGame}
          className="bg-gray-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-600"
        >
          New Game
        </button>
      </div>
      {currentNumber && <p className="text-xl mt-2 text-coinbase-blue">Current Draw: {currentNumber}</p>}
      {isWin && <p className="text-2xl font-bold text-coinbase-blue mt-4 animate-pulse">BINGO! You Win 100 $BINGO (coming soon!)</p>}
    </div>
  );
}