import {toHex} from "@cosmjs/encoding"
import {config} from "dotenv";
import {getSignerFromMnemonic} from "../../src/util/signer";
import {OfflineDirectSigner} from "@cosmjs/proto-signing";
import {expect} from "chai";
import {CheckersSigningStargateClient} from "../../src/checkers_signingstargateclient";
import {CheckersExtension} from "../../src/modules/checkers/queries";
import {Account, DeliverTxResponse, GasPrice} from "@cosmjs/stargate";
import {askFaucet} from "../../src/util/faucet";
import Long from "long"
import {Log} from "@cosmjs/stargate/build/logs";
import {
  getCapturedPos,
  getCreateGameEvent,
  getCreateGameId,
  getMovePlayedEvent, getWinner
} from "../../src/types/checkers/events";
import {StoredGame} from "../../src/types/generated/checkers/stored_game";
import {completeGame, GameMove, GamePiece, Player} from "../../src/types/checkers/player";
import {CheckersStargateClient} from "../../src/checkers_stargateclient";
import {TxRaw} from "cosmjs-types/cosmos/tx/v1beta1/tx"
import {typeUrlMsgPlayMove} from "../../src/types/checkers/messages";
import {BroadcastTxSyncResponse} from "@cosmjs/tendermint-rpc";

config()

describe("StoredGame Action", async function () {
  const {
    RPC_URL,
    ADDRESS_TEST_ALICE,
    ADDRESS_TEST_BOB,
    MNEMONIC_TEST_ALICE,
    MNEMONIC_TEST_BOB
  } = process.env
  let aliceSigner: OfflineDirectSigner, bobSigner: OfflineDirectSigner
  let aliceClient: CheckersSigningStargateClient, bobClient: CheckersSigningStargateClient
  let checkers: CheckersExtension["checkers"]
  const aliceCredit = {stake: 100, token: 1}, bobCredit = {stake: 100, token: 1}

  before("create signers", async function () {
    aliceSigner = await getSignerFromMnemonic(MNEMONIC_TEST_ALICE)
    bobSigner = await getSignerFromMnemonic(MNEMONIC_TEST_BOB)
    expect((await aliceSigner.getAccounts())[0].address).to.equal(ADDRESS_TEST_ALICE)
    expect((await bobSigner.getAccounts())[0].address).to.equal(ADDRESS_TEST_BOB)
  })

  before("create signing clients", async function () {
    aliceClient = await CheckersSigningStargateClient.connectWithSigner(RPC_URL, aliceSigner, {
      gasPrice: GasPrice.fromString("0stake")
    })
    bobClient = await CheckersSigningStargateClient.connectWithSigner(RPC_URL, bobSigner, {
      gasPrice: GasPrice.fromString("0stake")
    })
    checkers = aliceClient.checkersQueryClient!.checkers
  })

  before("credit test accounts", async function () {
    this.timeout(10_000)
    await askFaucet(ADDRESS_TEST_ALICE, aliceCredit)
    await askFaucet(ADDRESS_TEST_BOB, bobCredit)
    expect(
      parseInt(
        (await aliceClient.getBalance(ADDRESS_TEST_ALICE, "stake")).amount, 10)
    ).to.be.greaterThanOrEqual(aliceCredit.stake)
    expect(
      parseInt(
        (await aliceClient.getBalance(ADDRESS_TEST_ALICE, "token")).amount, 10)
    ).to.be.greaterThanOrEqual(aliceCredit.token)
    expect(
      parseInt(
        (await bobClient.getBalance(ADDRESS_TEST_BOB, "stake")).amount, 10)
    ).to.be.greaterThanOrEqual(bobCredit.stake)
    expect(
      parseInt(
        (await bobClient.getBalance(ADDRESS_TEST_BOB, "token")).amount, 10)
    ).to.be.greaterThanOrEqual(bobCredit.token)
  })

  let gameIndex: string

  it("can create game with wager", async function () {
    this.timeout(5_000)
    const response: DeliverTxResponse = await aliceClient.createGame(
      ADDRESS_TEST_ALICE,
      ADDRESS_TEST_ALICE,
      ADDRESS_TEST_BOB,
      "token",
      Long.fromNumber(1),
      "auto"
    )
    const logs: Log[] = JSON.parse(response.rawLog!)
    expect(logs).to.be.length(1)
    gameIndex = getCreateGameId(getCreateGameEvent(logs[0])!)
    const game: StoredGame = (await checkers.getStoredGame(gameIndex))!
    expect(game).to.include({
      index: gameIndex,
      black: ADDRESS_TEST_ALICE,
      red: ADDRESS_TEST_BOB,
      denom: "token",
    })
    expect(game.wager.toNumber()).to.equal(1)
  })

  it("can play first moves and pay wager", async function () {
    this.timeout(10_000)
    const aliceBalBefore = parseInt(
      (await aliceClient.getBalance(ADDRESS_TEST_ALICE, "token")).amount, 10
    )
    await aliceClient.playMove(ADDRESS_TEST_ALICE, gameIndex, {x: 1, y: 2}, {x: 2, y: 3}, "auto")
    const aliceBalAfter = parseInt(
      (await aliceClient.getBalance(ADDRESS_TEST_ALICE, "token")).amount, 10
    )
    expect(aliceBalAfter).to.be.equal(aliceBalBefore - 1)
    const bobBalBefore = parseInt(
      (await bobClient.getBalance(ADDRESS_TEST_BOB, "token")).amount, 10
    )
    await bobClient.playMove(ADDRESS_TEST_BOB, gameIndex, {x: 0, y: 5}, {x: 1, y: 4}, "auto")
    const bobBalAfter = parseInt(
      (await bobClient.getBalance(ADDRESS_TEST_BOB, "token")).amount, 10
    )
    expect(bobBalAfter).to.be.equal(bobBalBefore - 1)
  })

  interface ShortAccountInfo {
    accountNumber: number
    sequence: number
  }

  const getShortAccountInfo = async (who: string): Promise<ShortAccountInfo> => {
    const accountInfo: Account = (await aliceClient.getAccount(who))!
    return {
      accountNumber: accountInfo.accountNumber,
      sequence: accountInfo.sequence
    }
  }
  const whoseClient = (who: Player) => (who == "b" ? aliceClient : bobClient)
  const whoseAddress = (who: Player) => (who == "b" ? ADDRESS_TEST_ALICE : ADDRESS_TEST_BOB)

  it("Can continue the game up to before the double capture", async function () {
    this.timeout(10_000)
    const client: CheckersStargateClient = await CheckersStargateClient.connect(RPC_URL)
    const chainId: string = await client.getChainId()
    const accountInfo = {
      b: await getShortAccountInfo(ADDRESS_TEST_ALICE),
      r: await getShortAccountInfo(ADDRESS_TEST_BOB)
    }
    const txList: TxRaw[] = []
    let txIndex: number = 2
    while (txIndex < 24) {
      const gameMove: GameMove = completeGame[txIndex]
      txList.push(
        await whoseClient(gameMove.player).sign(
          whoseAddress(gameMove.player),
          [
            {
              typeUrl: typeUrlMsgPlayMove,
              value: {
                creator: whoseAddress(gameMove.player),
                gameIndex: gameIndex,
                fromX: gameMove.from.x,
                fromY: gameMove.from.y,
                toX: gameMove.to.x,
                toY: gameMove.to.y,
              }
            }
          ],
          {
            amount: [{denom: "stake", amount: "0"}],
            gas: "500000",
          },
          `playing move ${txIndex}`,
          {
            accountNumber: accountInfo[gameMove.player].accountNumber,
            sequence: accountInfo[gameMove.player].sequence++,
            chainId: chainId,
          }
        )
      )
      txIndex++
    }

    const hashes: BroadcastTxSyncResponse[] = []
    txIndex = 0
    while (txIndex < txList.length - 1) {
      const txRaw: TxRaw = txList[txIndex]
      hashes.push(await client.tmBroadcastTxSync(TxRaw.encode(txRaw).finish()))
      txIndex++
    }
    const lastDeliver: DeliverTxResponse = await client.broadcastTx(
      TxRaw.encode(txList[txList.length - 1]).finish()
    )

    console.log(
      txList.length,
      "transactions included in blocks from",
      (await client.getTx(toHex(hashes[0].hash)))!.height,
      "to",
      lastDeliver.height
    )

    const game: StoredGame = (await checkers.getStoredGame(gameIndex))!
    expect(game.board).to.equal(
      "*b*b***b|**b*b***|***b***r|********|***r****|********|***r****|r*B*r*r*")
  })

  it("can send a double move and create a game", async function () {
    this.timeout(5_000)
    const firstCaptureMove: GameMove = completeGame[24]
    const secondCaptureMove: GameMove = completeGame[25]
    const response: DeliverTxResponse = await aliceClient.signAndBroadcast(
      ADDRESS_TEST_ALICE,
      [
        {
          typeUrl: typeUrlMsgPlayMove,
          value: {
            creator: ADDRESS_TEST_ALICE,
            gameIndex: gameIndex,
            fromX: firstCaptureMove.from.x,
            fromY: firstCaptureMove.from.y,
            toX: firstCaptureMove.to.x,
            toY: firstCaptureMove.to.y,
          },
        },
        {
          typeUrl: typeUrlMsgPlayMove,
          value: {
            creator: ADDRESS_TEST_ALICE,
            gameIndex: gameIndex,
            fromX: secondCaptureMove.from.x,
            fromY: secondCaptureMove.from.y,
            toX: secondCaptureMove.to.x,
            toY: secondCaptureMove.to.y,
          },
        }
      ],
      "auto"
    )
    const logs: Log[] = JSON.parse(response.rawLog!)
    expect(logs).to.be.length(2)
    expect(getCapturedPos(getMovePlayedEvent(logs[0])!)).to.deep.equal({
      x: 3,
      y: 6,
    })
    expect(getCapturedPos(getMovePlayedEvent(logs[1])!)).to.deep.equal({
      x: 3,
      y: 4,
    })
  })

  it("can conclude the game", async function () {
    this.timeout(10_000)
    const client: CheckersStargateClient = await CheckersStargateClient.connect(RPC_URL)
    const chainId: string = await client.getChainId()
    const accountInfo = {
      b: await getShortAccountInfo(ADDRESS_TEST_ALICE),
      r: await getShortAccountInfo(ADDRESS_TEST_BOB)
    }
    const txList: TxRaw[] = []
    let txIndex: number = 26
    while (txIndex < completeGame.length) {
      const gameMove: GameMove = completeGame[txIndex]
      txList.push(
        await whoseClient(gameMove.player).sign(
          whoseAddress(gameMove.player),
          [
            {
              typeUrl: typeUrlMsgPlayMove,
              value: {
                creator: whoseAddress(gameMove.player),
                gameIndex: gameIndex,
                fromX: gameMove.from.x,
                fromY: gameMove.from.y,
                toX: gameMove.to.x,
                toY: gameMove.to.y,
              },
            }
          ],
          {
            amount: [{denom: "stake", amount: "0"}],
            gas: "500000",
          },
          `playing move ${txIndex}`,
          {
            accountNumber: accountInfo[gameMove.player].accountNumber,
            sequence: accountInfo[gameMove.player].sequence++,
            chainId: chainId,
          }
        )
      )
      txIndex++
    }

    txIndex = 0
    while (txIndex < txList.length - 1) {
      const txRaw: TxRaw = txList[txIndex]
      await client.tmBroadcastTxSync(TxRaw.encode(txRaw).finish())
      txIndex++
    }

    const aliceBalBefore = parseInt((await client.getBalance(ADDRESS_TEST_ALICE, "token")).amount,
      10)
    const bobBalBefore = parseInt((await client.getBalance(ADDRESS_TEST_BOB, "token")).amount, 10)
    const lastDeliver: DeliverTxResponse = await client.broadcastTx(
      TxRaw.encode(txList[txList.length - 1]).finish(),
    )
    expect(parseInt((await client.getBalance(ADDRESS_TEST_ALICE, "token")).amount, 10)).to.be.equal(
      aliceBalBefore + 2)
    expect(parseInt((await client.getBalance(ADDRESS_TEST_BOB, "token")).amount, 10)).to.be.equal(
      bobBalBefore)

    const logs: Log[] = JSON.parse(lastDeliver.rawLog!)
    expect(logs).to.be.length(1)
    const winner: GamePiece = getWinner(getMovePlayedEvent(logs[0])!)!
    expect(winner).to.be.equal("b")
    const game: StoredGame = (await checkers.getStoredGame(gameIndex))!
    expect(game).to.include({
      winner: "b",
      board: ""
    })
  })

  it("can reject a game properly when no moves", async function() {
    this.timeout(10_000)
    let response: DeliverTxResponse = await aliceClient.createGame(
      ADDRESS_TEST_ALICE,
      ADDRESS_TEST_ALICE,
      ADDRESS_TEST_BOB,
      "token",
      Long.fromNumber(10),
      "auto"
    )
    let logs: Log = JSON.parse(response.rawLog)
    let gameIndexReject = getCreateGameId(getCreateGameEvent(logs[0])!)
    response = await aliceClient.rejectGame(ADDRESS_TEST_ALICE, gameIndexReject, "auto")
    try{
      await checkers.getStoredGame(gameIndexReject)
      expect.fail("Expected game to be removed!")
    } catch (e) {
      expect(e.toString()).to.equal(
        "Error: Query failed with (22): rpc error: code = NotFound desc = not found: key not found"
      )
    }
  })
})