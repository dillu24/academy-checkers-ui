import {IGameInfo} from "../../sharedTypes";
import {CheckersStargateClient} from "../../checkers_stargateclient";
import {storedToGameInfo} from "./board";
import Long from "long";
import {AllStoredGameResponse} from "../../modules/checkers/queries";
import {StoredGame} from "../generated/checkers/stored_game";

declare module "../../checkers_stargateclient" {
  interface CheckersStargateClient {
    getGuiGames(): Promise<IGameInfo[]>

    getGuiGame(index: string): Promise<IGameInfo | undefined>
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