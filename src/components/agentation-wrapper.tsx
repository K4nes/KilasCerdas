'use client';

import dynamic from 'next/dynamic';

const Agentation = dynamic(
  () => import('agentation').then((mod) => mod.Agentation),
  { ssr: false }
);

export default function AgentationWrapper() {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Agentation
      endpoint="http://localhost:4747"
      onSessionCreated={(sessionId) => {
        console.log("Session started:", sessionId);
      }}
    />
  );
}
