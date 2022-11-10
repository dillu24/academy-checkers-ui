import {Player} from "./player";
import {StoredGame} from "../generated/checkers/stored_game";
import {IGameInfo, IPlayerInfo} from "../../sharedTypes";

const rowSeparator = "|"
export const pieceTranslator = {
  "*": 0,
  "b": 1,
  "r": 2
}
export const playerReverseTranslator: Player[] = ["b", "r"]
export const pieceReverseTranslator = ["*", ...playerReverseTranslator]

export function serializedToBoard(serialized: string): number[][] {
  return serialized
    .split(rowSeparator)
    .map((row: string) => row.split("").map((char: string) => pieceTranslator[char]))
}

export function storedToGameInfo(game: StoredGame): IGameInfo {
  return {
    board: serializedToBoard(game.board),
    created: new Date(Date.now()),
    last: new Date(Date.parse(game.deadline) - 86400 * 1000),
    isNewGame: game.moveCount.equals(0),
    p1: {
      name: game.black,
      is_ai: false,
      score: 0,
    },
    p2: {
      name: game.red,
      is_ai: false,
      score: 0,
    },
    turn: pieceTranslator[game.turn],
    index: parseInt(game.index),
  }
}

export function storedToGameInfos(games: StoredGame[]): IGameInfo[] {
  return games.map(storedToGameInfo)
}