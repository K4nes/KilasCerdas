'use client';

import { useGameSocket } from '@/hooks/use-game-socket';
import { ToastList } from '@/components/toast';
import LobbyScreen from '@/components/room/lobby-screen';
import CountdownScreen from '@/components/room/countdown-screen';
import DuelScreen from '@/components/room/duel-screen';
import ResultScreen from '@/components/room/result-screen';
import TopicSelectScreen from '@/components/room/topic-select-screen';

export default function RoomPage() {
  const {
    // Identity
    playerId, playerName, isHost,
    // Room
    players, roomData, status,
    // Countdown
    countdown,
    // Duel
    currentQuestion, qIndex, totalQuestions,
    selectedAnswer, answerState, correctAnswer, scores,
    timerWidth, timerBgClass, showAnswerFeedback,
    myScore, opponent, opponentScore,
    // Result
    result,
    // Rematch
    rematchInvite, inviteRemainingMs, myRematchLocked,
    lastInviteRole, lastTopic, lastQuestionCount,
    // UI
    toasts, confettiCanvasRef, copied,
    // Handlers
    handleStartDuel, handleAnswer, handleCopyCode,
    handleRematch, handleAcceptRematch, handleDeclineRematch,
    handleRematchStart, handleGoHome,
  } = useGameSocket();

  // ─── Loading ───────────────────────────────────────────
  if (!playerId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="spinner" />
      </div>
    );
  }

  // ─── Result ────────────────────────────────────────────
  if (status === 'finished' && result) {
    return (
      <ResultScreen
        result={result}
        playerId={playerId}
        playerName={playerName}
        opponent={opponent}
        myScore={myScore}
        opponentScore={opponentScore}
        roomData={roomData}
        toasts={toasts}
        confettiCanvasRef={confettiCanvasRef}
        rematchInvite={rematchInvite}
        inviteRemainingMs={inviteRemainingMs}
        myRematchLocked={myRematchLocked}
        lastInviteRole={lastInviteRole}
        onRematch={handleRematch}
        onAcceptRematch={handleAcceptRematch}
        onDeclineRematch={handleDeclineRematch}
        onGoHome={handleGoHome}
      />
    );
  }

  // ─── Countdown ─────────────────────────────────────────
  if (status === 'countdown' && countdown !== null && countdown >= 0) {
    return (
      <>
        <ToastList toasts={toasts} />
        <CountdownScreen countdown={countdown} />
      </>
    );
  }

  // ─── Duel ──────────────────────────────────────────────
  if (status === 'playing' && currentQuestion) {
    return (
      <>
        <ToastList toasts={toasts} />
        <DuelScreen
          currentQuestion={currentQuestion}
          qIndex={qIndex}
          totalQuestions={totalQuestions}
          playerName={playerName}
          myScore={myScore}
          opponent={opponent}
          opponentScore={opponentScore}
          timerWidth={timerWidth}
          timerBgClass={timerBgClass}
          selectedAnswer={selectedAnswer}
          answerState={answerState}
          correctAnswer={correctAnswer}
          showAnswerFeedback={showAnswerFeedback}
          onAnswer={handleAnswer}
        />
      </>
    );
  }

  // ─── Topic Select ──────────────────────────────────────
  if (status === 'topic_select') {
    return (
      <TopicSelectScreen
        players={players}
        playerId={playerId}
        roomData={roomData}
        opponent={opponent}
        isHost={isHost}
        lastTopic={lastTopic}
        lastQuestionCount={lastQuestionCount}
        toasts={toasts}
        onRematchStart={handleRematchStart}
      />
    );
  }

  // ─── Lobby (default) ───────────────────────────────────
  return (
    <LobbyScreen
      players={players}
      roomData={roomData}
      roomId={roomData?.id || ''}
      isHost={isHost}
      playerId={playerId}
      playerName={playerName}
      toasts={toasts}
      copied={copied}
      onCopyCode={handleCopyCode}
      onStartDuel={handleStartDuel}
      onGoHome={handleGoHome}
    />
  );
}
