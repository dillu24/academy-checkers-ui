import {IGameInfo} from "../../sharedTypes";
import {CheckersStargateClient} from "../../checkers_stargateclient";
import {storedToGameInfo} from "./board";
import Long from "long";
import {AllStoredGameResponse} from "../../modules/checkers/queries";
import {StoredGame} from "../generated/checkers/stored_game";
import {CheckersSigningStargateClient} from "../../checkers_signingstargateclient";
import {DeliverTxResponse} from "@cosmjs/stargate";
import {Log} from "@cosmjs/stargate/build/logs";
import {getCreateGameEvent, getCreateGameId} from "./events";

declare module "../../checkers_stargateclient" {
  interface CheckersStargateClient {
    getGuiGames(): Promise<IGameInfo[]>

    getGuiGame(index: string): Promise<IGameInfo | undefined>
  }
}

declare module "../../checkers_signingstargateclient" {
  interface CheckersSigningStargateClient {
    createGuiGame(creator: string, black: string, red: string): Promise<string>
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
