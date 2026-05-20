import { NextRequest, NextResponse } from 'next/server';

// We don't import roomManager here since it runs on the server.js side
// This is just for client-side API, the actual room creation is handled by server.js via Socket.io
// The server.js API handler takes priority for /api/room/create

export async function POST(req: NextRequest) {
  // This route is handled by the custom server (server.js)
  // This file exists to prevent Next.js 404
  const body = await req.json();
  return NextResponse.json({
    success: true,
    roomId: body.roomId || 'PENDING',
    message: 'Room creation handled by Socket.io server',
  });
}
