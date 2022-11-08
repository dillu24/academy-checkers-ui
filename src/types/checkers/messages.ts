import {EncodeObject, GeneratedType} from "@cosmjs/proto-signing"
import {
  MsgCreateGame,
  MsgCreateGameResponse,
  MsgPlayMove,
  MsgPlayMoveResponse,
  MsgRejectGame,
  MsgRejectGameResponse
} from "../generated/checkers/tx";

export const typeUrlMsgCreateGame = "/alice.checkers.checkers.MsgCreateGame"
export const typeUrlMsgCreateGameResponse = "/alice.checkers.checkers.MsgCreateGameResponse"
export const typeUrlMsgPlayMove = "/alice.checkers.checkers.MsgPlayMove"
export const typeUrlMsgPlayMoveResponse = "/alice.checkers.checkers.MsgPlayMoveResponse"
export const typeUrlMsgRejectGame = "/alice.checkers.checkers.MsgRejectGame"
export const typeUrlMsgRejectGameResponse = "/alice.checkers.checkers.MsgRejectGameResponse"

export const checkersTypes: ReadonlyArray<[string, GeneratedType]> = [
  [typeUrlMsgCreateGame, MsgCreateGame],
  [typeUrlMsgCreateGameResponse, MsgCreateGameResponse],
  [typeUrlMsgPlayMove, MsgPlayMove],
  [typeUrlMsgPlayMoveResponse, MsgPlayMoveResponse],
  [typeUrlMsgRejectGame, MsgRejectGame],
  [typeUrlMsgRejectGameResponse, MsgRejectGameResponse]
]

export interface MsgCreateGameEncodeObject extends EncodeObject {
  readonly typeUrl: "/alice.checkers.checkers.MsgCreateGame"
  readonly value: Partial<MsgCreateGame>
}

export function isMsgCreateGameEncodeObject(
  encodeObject: EncodeObject
): encodeObject is MsgCreateGameEncodeObject {
  return (encodeObject as MsgCreateGameEncodeObject).typeUrl === typeUrlMsgCreateGame
}

export interface MsgCreateGameResponseEncodeObject extends EncodeObject {
  readonly typeUrl: "/alice.checkers.checkers.MsgCreateGameResponse"
  readonly value: Partial<MsgCreateGameResponse>
}

export function isMsgCreateGameResponseEncodeObject(
  encodeObject: EncodeObject
): encodeObject is MsgCreateGameResponseEncodeObject {
  return (
    encodeObject as MsgCreateGameResponseEncodeObject
  ).typeUrl === typeUrlMsgCreateGameResponse
}

export interface MsgPlayMoveEncodeObject extends EncodeObject {
  readonly typeUrl: "/alice.checkers.checkers.MsgPlayMove"
  readonly value: Partial<MsgPlayMove>
}

export function isMsgPlayMoveEncodeObject(
  encodeObject: EncodeObject
): encodeObject is MsgPlayMoveEncodeObject {
  return (encodeObject as MsgPlayMoveEncodeObject).typeUrl === typeUrlMsgPlayMove
}

export interface MsgPlayMoveResponseEncodeObject extends EncodeObject {
  readonly typeUrl: "/alice.checkers.checkers.MsgPlayMoveResponse"
  readonly value: Partial<MsgPlayMoveResponse>
}

export function isMsgPlayMoveResponseEncodeObject(
  encodeObject: EncodeObject
): encodeObject is MsgPlayMoveResponseEncodeObject {
  return (
    encodeObject as MsgPlayMoveResponseEncodeObject
  ).typeUrl === typeUrlMsgPlayMoveResponse
}

export interface MsgRejectGameEncodeObject extends EncodeObject {
  readonly typeUrl: "/alice.checkers.checkers.MsgRejectGame"
  readonly value: Partial<MsgRejectGame>
}

export function isMsgRejectGameEncodeObject(
  encodeObject: EncodeObject
): encodeObject is MsgRejectGameEncodeObject {
  return (encodeObject as MsgRejectGameEncodeObject).typeUrl === typeUrlMsgRejectGame
}

export interface MsgRejectGameResponseEncodeObject extends EncodeObject {
  readonly typeUrl: "/alice.checkers.checkers.MsgRejectGameResponse"
  readonly value: Partial<MsgRejectGameResponse>
}

export function isMsgRejectGameResponseEncodeObject(
  encodeObject: EncodeObject
): encodeObject is MsgRejectGameResponseEncodeObject {
  return (
    encodeObject as MsgRejectGameResponseEncodeObject
  ).typeUrl === typeUrlMsgRejectGameResponse
}