import {IGameInfo} from "../../sharedTypes";
import {CheckersStargateClient} from "../../checkers_stargateclient";
import {guiPositionToPos, storedToGameInfo} from "./board";
import Long from "long";
import {AllStoredGameResponse} from "../../modules/checkers/queries";
import {StoredGame} from "../generated/checkers/stored_game";
import {CheckersSigningStargateClient} from "../../checkers_signingstargateclient";
import {DeliverTxResponse} from "@cosmjs/stargate";
import {Log} from "@cosmjs/stargate/build/logs";
import {getCapturedPos, getCreateGameEvent, getCreateGameId, getMovePlayedEvent} from "./events";
import {QueryCanPlayMoveResponse} from "../generated/checkers/query";
import {Pos} from "./player";
import {MsgPlayMoveEncodeObject, typeUrlMsgPlayMove} from "./messages";

declare module "../../checkers_stargateclient" {
  interface CheckersStargateClient {
    getGuiGames(): Promise<IGameInfo[]>
    canPlayGuiMove(
      gameIndex: string,
      playerId: number,
      positions: number[][]
    ): Promise<QueryCanPlayMoveResponse>
    getGuiGame(index: string): Promise<IGameInfo | undefined>
  }
}

declare module "../../checkers_signingstargateclient" {
  interface CheckersSigningStargateClient {
    createGuiGame(creator: string, black: string, red: string): Promise<string>
    playGuiMoves(
      creator: string,
      gameIndex: string,
      positions: number[][]
    ): Promise<(Pos | undefined)[]>
  }
}

CheckersStargateClient.prototype.getGuiGames = async function (): Promise<IGameInfo[]> {
  let nextKey: Uint8Array | undefined = Uint8Array.from([])
  let games: IGameInfo[] = []
  while (true) {
    let allStoredGameResponse: AllStoredGameResponse =
      await this.checkersQueryClient!.checkers.getAllStoredGames(
        nextKey,
        Long.ZERO,
        Long.fromNumber(20),
        true,
      )
    games.push(...allStoredGameResponse.storedGames.map(storedToGameInfo))
    nextKey = allStoredGameResponse.pagination?.nextKey
    if (JSON.stringify(nextKey) === JSON.stringify(Uint8Array.from([])) || nextKey === undefined) {
      break
    }
  }
  return games
}

CheckersStargateClient.prototype.getGuiGame =
  async function (index: string): Promise<IGameInfo | undefined> {
    const storedGame: StoredGame | undefined =
      await this.checkersQueryClient!.checkers.getStoredGame(index)
    if (!storedGame) return undefined
    return storedToGameInfo(storedGame)
  }

CheckersSigningStargateClient.prototype.createGuiGame = async function (
  creator: string,
  black: string,
  red: string
): Promise<string> {
  const result: DeliverTxResponse = await this.createGame(creator, black, red, "stake", Long.ZERO,
    "auto")
  const logs: Log[] = JSON.parse(result.rawLog!)
  return getCreateGameId(getCreateGameEvent(logs[0])!)
}

CheckersStargateClient.prototype.canPlayGuiMove = async function (
  gameIndex: string,
  playerId: number,
  positions: number[][]
): Promise<QueryCanPlayMoveResponse> {
  if (playerId < 1 || playerId > 2) throw new Error(`Wrong playerId: ${playerId}`)
  return await this.checkersQueryClient!.checkers.canPlayMove(
    gameIndex,
    playerId == 1 ? "b" : "r",
    guiPositionToPos(positions[0]),
    guiPositionToPos(positions[1])
  )
}

CheckersSigningStargateClient.prototype.playGuiMoves = async function (
  creator: string,
  gameIndex: string,
  positions: number[][]
): Promise<(Pos | undefined)[]> {
  const playMoveMsgList: MsgPlayMoveEncodeObject[] = positions
    .slice(0, positions.length - 1)
    .map((position: number[], index: number) => {
      const from: Pos = guiPositionToPos(position)
      const to: Pos = guiPositionToPos(positions[index + 1])
      return {
        typeUrl: typeUrlMsgPlayMove,
        value: {
          creator: creator,
          gameIndex: gameIndex,
          fromX: Long.fromNumber(from.x),
          fromY: Long.fromNumber(from.y),
          toX: Long.fromNumber(to.x),
          toY: Long.fromNumber(to.y),
        },
      }
    })
  const result: DeliverTxResponse = await this.signAndBroadcast(creator, playMoveMsgList, "auto")
  const logs: Log[] = JSON.parse(result.rawLog!)
  return logs.map((log: Log) => getCapturedPos(getMovePlayedEvent(log)!))
}
