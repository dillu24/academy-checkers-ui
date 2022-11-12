import {writeFile} from "fs/promises"
import {Server} from "http"
import express, {Express, Request, Response} from "express"
import {DbType, PlayerInfo} from "./types"
import {config} from "dotenv"
import {Block, IndexedTx} from "@cosmjs/stargate";
import {sha256} from "@cosmjs/crypto"
import {toHex} from "@cosmjs/encoding"
import {ABCIMessageLog, StringEvent} from "cosmjs-types/cosmos/base/abci/v1beta1/abci"
import {Attribute} from "@cosmjs/stargate/build/logs";
import {IndexerStargateClient} from "./indexer_stargateclient";

config()

export const createIndexer = async () => {
  const port = "3001"
  const dbFile = `${__dirname}/db.json`
  const db: DbType = require(dbFile)
  const pollIntervalMs = 5_000 // 5 seconds
  let timer: NodeJS.Timer | undefined
  let client: IndexerStargateClient


  const app: Express = express()
  app.get("/", (req: Request, res: Response) => {
    res.send({
      error: "Not implemented",
    })
  })

  app.get("/status", (req: Request, res: Response) => {
    res.json({
      block: {
        height: db.status.block.height,
      },
    })
  })

  app.get("/players/:playerAddress", (req: Request, res: Response) => {
    res.json({
      gameCount: db.players[req.params.playerAddress]?.gameIds?.length ?? 0,
      gameIds: db.players[req.params.playerAddress]?.gameIds ?? [],
    })
  })

  app.get("/players/:playerAddress/gameIds", (req: Request, res: Response) => {
    res.json(db.players[req.params.playerAddress]?.gameIds ?? [])
  })

  app.patch("/games/:gameId", (req: Request, res: Response) => {
    res.json({
      result: "Not implemented",
    })
  })

  const saveDb = async () => {
    await writeFile(dbFile, JSON.stringify(db, null, 4))
  }

  const init = async () => {
    client = await IndexerStargateClient.connect(process.env.RPC_URL!)
    console.log("Connected to chain-id:", await client.getChainId())
    setTimeout(poll, 1)
  }

  const poll = async () => {
    const currentHeight = await client.getHeight()
    if (db.status.block.height <= currentHeight - 100)
      console.log(`Catching up ${db.status.block.height}..${currentHeight}`)
    while (db.status.block.height < currentHeight) {
      const processing = db.status.block.height + 1
      process.stdout.cursorTo(0)
      const block: Block = await client.getBlock(processing)
      process.stdout.write(`Handling block: ${processing} with ${block.txs.length} txs`)
      await handleBlock(block)
      db.status.block.height = processing
    }
    await saveDb()
    timer = setTimeout(poll, pollIntervalMs)
  }

  const handleBlock = async (block: Block) => {
    if (0 < block.txs.length) console.log("")
    let txIndex = 0
    while (txIndex < block.txs.length) {
      const txHash: string = toHex(sha256(block.txs[txIndex])).toUpperCase()
      const indexed: IndexedTx | null = await client.getTx(txHash)
      if (!indexed) throw new Error(`Could not find indexed tx: ${txHash}`)
      await handleTx(indexed)
      txIndex++
    }
    const events: StringEvent[] = await client.getEndBlockEvents(block.header.height)
    if (0 < events.length) console.log("")
    await handleEvents(events)
  }

  const handleTx = async (indexed: IndexedTx) => {
    const rawLog: any = JSON.parse(indexed.rawLog)
    const events: StringEvent[] = rawLog.flatMap((log: ABCIMessageLog) => log.events)
    await handleEvents(events)
  }

  const handleEvents = async (events: StringEvent[]): Promise<void> => {
    try {
      let eventIndex = 0
      while (eventIndex < events.length) {
        await handleEvent(events[eventIndex])
        eventIndex++
      }
    } catch (e) {
      // Skipping if the handling failed. Most likely the transaction failed.
    }
  }

  const handleEvent = async (event: StringEvent): Promise<void> => {
    if (event.type == "new-game-created") {
      await handleEventCreate(event)
    }
    if (event.type == "game-rejected") {
      await handleEventReject(event)
    }
    if (event.type == "move-played") {
      await handleEventPlay(event)
    }
    if (event.type == "game-forfeited") {
      await handleEventForfeit(event)
    }
  }

  const getAttributeValueByKey = (attributes: Attribute[], key: string): string | undefined => {
    return attributes.find((attribute: Attribute) => attribute.key === key)?.value
  }

  const handleEventCreate = async (event: StringEvent): Promise<void> => {
    const newId: string | undefined = getAttributeValueByKey(event.attributes, "game-index")
    if (!newId) throw new Error(`Create event missing game-index`)
    const blackAddress: string | undefined = getAttributeValueByKey(event.attributes, "black")
    if (!blackAddress) throw new Error(`Create event missing black address`)
    const redAddress: string | undefined = getAttributeValueByKey(event.attributes, "red")
    if (!redAddress) throw new Error(`Create event missing red address`)
    console.log(`New game: ${newId}, black: ${blackAddress}, red: ${redAddress}`)
    const blackInfo: PlayerInfo = db.players[blackAddress] ?? {
      gameIds: [],
    }
    const redInfo: PlayerInfo = db.players[redAddress] ?? {
      gameIds: [],
    }
    if (blackInfo.gameIds.indexOf(newId) < 0) blackInfo.gameIds.push(newId)
    if (redInfo.gameIds.indexOf(newId) < 0) redInfo.gameIds.push(newId)
    db.players[blackAddress] = blackInfo
    db.players[redAddress] = redInfo
    db.games[newId] = {
      redAddress: redAddress,
      blackAddress: blackAddress,
      deleted: false,
    }
  }

  const handleEventReject = async (event: StringEvent): Promise<void> => {
    const rejectedId: string | undefined = getAttributeValueByKey(event.attributes, "game-index")
    if (!rejectedId) throw new Error(`Reject event missing game-index`)
    const blackAddress: string | undefined = db.games[rejectedId]?.blackAddress
    const redAddress: string | undefined = db.games[rejectedId]?.redAddress
    console.log(`Reject game: ${rejectedId}, black: ${blackAddress}, red: ${redAddress}`)
    const blackGames: string[] = db.players[blackAddress]?.gameIds ?? []
    const redGames: string[] = db.players[redAddress]?.gameIds ?? []
    const indexInBlack: number = blackGames.indexOf(rejectedId)
    if (0 <= indexInBlack) blackGames.splice(indexInBlack, 1)
    const indexInRed: number = redGames.indexOf(rejectedId)
    if (0 <= indexInRed) redGames.splice(indexInRed, 1)
    if (db.games[rejectedId]) db.games[rejectedId].deleted = true
  }

  const handleEventPlay = async (event: StringEvent): Promise<void> => {
    const playedId: string | undefined = getAttributeValueByKey(event.attributes, "game-index")
    if (!playedId) throw new Error(`Play event missing game-index`)
    const winner: string | undefined = getAttributeValueByKey(event.attributes, "winner")
    if (!winner) throw new Error("Play event missing winner")
    if (winner === "*") return
    const blackAddress: string | undefined = db.games[playedId]?.blackAddress
    const redAddress: string | undefined = db.games[playedId]?.redAddress
    console.log(
      `Win game: ${playedId}, black: ${blackAddress}, red: ${redAddress}, winner: ${winner}`)
    const blackGames: string[] = db.players[blackAddress]?.gameIds ?? []
    const redGames: string[] = db.players[redAddress]?.gameIds ?? []
    const indexInBlack: number = blackGames.indexOf(playedId)
    if (0 <= indexInBlack) blackGames.splice(indexInBlack, 1)
    const indexInRed: number = redGames.indexOf(playedId)
    if (0 <= indexInRed) redGames.splice(indexInRed, 1)
  }

  const handleEventForfeit = async (event: StringEvent): Promise<void> => {
    const forfeitId: string | undefined = getAttributeValueByKey(event.attributes, "game-index")
    if (!forfeitId) throw new Error("Forfeit event missing game-index")
    const winner: string | undefined = getAttributeValueByKey(event.attributes, "winner")
    const blackAddress: string | undefined = db.games[forfeitId]?.blackAddress
    const redAddress: string | undefined = db.games[forfeitId]?.redAddress
    console.log(
      `Forfeit game: ${forfeitId}, black: ${blackAddress}, red: ${redAddress}, winner: ${winner}`,
    )
    const blackGames: string[] = db.players[blackAddress]?.gameIds ?? []
    const redGames: string[] = db.players[redAddress]?.gameIds ?? []
    const indexInBlack: number = blackGames.indexOf(forfeitId)
    if (0 <= indexInBlack) blackGames.splice(indexInBlack, 1)
    const indexInRed: number = redGames.indexOf(forfeitId)
    if (0 <= indexInRed) redGames.splice(indexInRed, 1)
    if (db.games[forfeitId]) db.games[forfeitId].deleted = true
  }

  process.on("SIGINT", () => {
    if (timer) clearTimeout(timer)
    saveDb()
      .then(() => {
        console.log(`${dbFile} saved`)
      })
      .catch(console.error)
      .finally(() => {
        server.close(() => {
          console.log("server closed")
          process.exit(0)
        })
      })
  })

  const server: Server = app.listen(port, () => {
    init()
      .catch(console.error)
      .then(() => {
        console.log(`\nserver started at http://localhost:${port}`)
      })
  })
}