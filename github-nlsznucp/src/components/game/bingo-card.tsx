import React, { useState, useEffect } from 'react';

interface Props {
  numbers: number[];
  calledNumbers: number[];
  onBingo?: () => void;
  hasBingo?: boolean;
  claimedBingo?: boolean;
}

export function BingoCard({ numbers, calledNumbers, onBingo, hasBingo, claimedBingo }: Props) {
  const [columns] = useState(['B', 'I', 'N', 'G', 'O']);
  const [grid, setGrid] = useState<number[][]>([]);

  useEffect(() => {
    // Convert flat array to 5x5 grid
    const newGrid: number[][] = [];
    for (let i = 0; i < 5; i++) {
      newGrid.push(numbers.slice(i * 5, (i + 1) * 5));
    }
    setGrid(newGrid);
  }, [numbers]);

  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-lg bg-white shadow-lg">
      {/* BINGO Title */}
      <div className="bg-blue-600 p-3 text-center">
        <h2 className="text-3xl font-bold tracking-wider text-white">BINGO</h2>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-5 bg-blue-500 p-2">
        {columns.map((letter) => (
          <div
            key={letter}
            className="flex h-10 items-center justify-center text-xl font-bold text-white"
          >
            {letter}
          </div>
        ))}
      </div>

      {/* Card Numbers */}
      <div className="grid grid-cols-5 gap-2 p-4">
        {grid.map((row, i) => (
          row.map((num, j) => {
            const isCenter = i === 2 && j === 2;
            const isMatched = isCenter || calledNumbers.includes(num);

            return (
              <div
                key={`${i}-${j}`}
                className={`relative flex h-16 flex-col items-center justify-center rounded-lg border-2 transition-all duration-300
                  ${isCenter 
                    ? 'border-yellow-500 bg-yellow-50' 
                    : isMatched
                      ? 'border-green-500 bg-green-100'
                      : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}
              >
                {isCenter ? (
                  <div className="flex flex-col items-center">
                    <span className="text-xs font-medium text-yellow-700">BONUS</span>
                    <div className="relative mt-1">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-6 w-6 rotate-45 transform bg-yellow-500 opacity-20"></div>
                      </div>
                      <span className="relative z-10 text-lg font-bold text-yellow-700">★</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <span className="text-xs text-gray-500">{columns[j]}</span>
                    <span className={`text-xl font-bold ${
                      isMatched ? 'text-green-700' : 'text-gray-800'
                    }`}>
                      {num}
                    </span>
                  </>
                )}
                {isMatched && !isCenter && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-full w-full rounded-lg bg-green-500 opacity-20"></div>
                    <div className="absolute h-1 w-full rotate-45 transform bg-green-500"></div>
                    <div className="absolute h-1 w-full -rotate-45 transform bg-green-500"></div>
                  </div>
                )}
              </div>
            );
          })
        ))}
      </div>

      {/* Bingo Button */}
      {onBingo && hasBingo && !claimedBingo && (
        <button
          onClick={onBingo}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 transform rounded-full bg-yellow-500 px-8 py-3 font-bold text-white shadow-lg transition-all hover:bg-yellow-600"
        >
          BINGO!
        </button>
      )}

      {/* Claimed Status */}
      {claimedBingo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 transform rounded-full bg-green-100 px-8 py-3 font-bold text-green-700">
          Bingo Claimed!
        </div>
      )}
    </div>
  );
}