// components/subscription/SuccessConfetti.jsx
import React from 'react';
import ConfettiExplosion from 'react-confetti-explosion';

const SuccessConfetti = ({ isExploding }) => {
  return (
    <>
      {isExploding && (
        <ConfettiExplosion
          force={0.8}
          duration={3000}
          particleCount={250}
          width={1600}
          colors={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444']}
        />
      )}
    </>
  );
};

export default SuccessConfetti;
