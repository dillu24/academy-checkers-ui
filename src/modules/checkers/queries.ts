import {StoredGame} from "../../types/generated/checkers/stored_game";
import {PageResponse} from "../../types/generated/cosmos/base/query/v1beta1/pagination";
import {SystemInfo} from "../../types/generated/checkers/system_info";
import Long from "long"
import {Player, Pos} from "../../types/checkers/player";
import {QueryCanPlayMoveResponse} from "../../types/generated/checkers/query";

export interface AllStoredGameResponse {
  storedGames: StoredGame[]
  pagination?: PageResponse
}

export interface CheckersExtension {
  readonly checkers: {
    readonly getSystemInfo: () => Promise<SystemInfo>
    readonly getStoredGame: (index: string) => Promise<StoredGame | undefined>
    readonly getAllStoredGames: (
      key: Uint8Array,
      offset: Long,
      limit: Long,
      countTotal: boolean,
    ) => Promise<AllStoredGameResponse>
    readonly canPlayMove: (
      index: string,
      player: Player,
      from: Pos,
      to: Pos,
    ) => Promise<QueryCanPlayMoveResponse>
  }
}