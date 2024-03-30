import { ethers } from 'ethers';
import { useSDK } from "@metamask/sdk-react";
import { useState, useEffect } from 'react';
import { Button, Container, Form, Alert, Col, Row } from 'react-bootstrap';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import BlockchainService from './BlockchainService';
import abi from './abi.json';
const { abi: contractAbi, byte } = abi;

function App() {

  const [blockchainService, setBlockchainService] = useState<BlockchainService | null>(null);
  const [account, setAccount] = useState<string>('');
  const [move, setMove] = useState<string>('1');
  const [player, setPlayer] = useState<string>('');
  const [stake, setStake] = useState<number>(0.001);
  const [message, setMessage] = useState<string>('');
  const [gameContract, setGameContract] = useState<string>('');
  const [otherContract, setOtherContract] = useState<string>('');
  const [ethBalance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  
  const supportedChainId = '0xaa36a7';
  const Moves = ['Null', 'Rock', 'Paper', 'Scissors', 'Spock', 'Lizard'];

  interface Game {
    address: string;
    player1: string;
    player2: string;
    stake: string;
    move1: number;
    move2: number;
    winner: string;
    salt: string | null;
  }
  const [games, setGames] = useState<Game[] | null>(null);
  const [currentGame, setCurrentGame] = useState<Game | null>(null);

  const { sdk, provider, connected, chainId, balance } = useSDK();


  useEffect(() => {
    async function init() {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      setBlockchainService(new BlockchainService(contractAbi, byte, provider as any, signer));
    }
    init();
    // Use the 'account' and 'chainId' returned by 'useSDK'
    if (account && chainId) {
        // Handle account and network changes
        setGames(JSON.parse(localStorage.getItem('games') || '[]') as Game[]);

        // Fetch the account balance in ETH
        setBalance(Number(ethers.formatEther(BigInt(balance || ''))));
    }

  }, [account, chainId, balance]);

  const createGame = async () => {
    if (!blockchainService || !move || !stake || !player) return;
    try {
      setLoading(true);
      const {salt, commitment} = await blockchainService.createCommitment(move);
      const result = await blockchainService.createGame(stake, player, salt, commitment);
      const newGames = [...(games || []), {
        address: result,
        player1: account,
        player2: player,
        stake: stake.toString(),
        move1: Number(move),
        move2: 0,
        winner: '',
        salt: salt
      }];
      setGames(newGames);
      localStorage.setItem('games', JSON.stringify(newGames));
      setGameContract(result);
      setMessage(`Game created with Player: ${player}`);
    } catch (error) {
      console.error(error);
      setMessage('Failed to create the game.');
    } finally {
      setLoading(false);
    }
  };

  const playMove = async () => {

    if (!blockchainService || !move || !stake) return;
    try {
      setLoading(true);
      await blockchainService.playGame(stake, move);
      const move2 = await blockchainService.player2Move();
      const newGames = games?.map(game => {
        if (game.address === gameContract) {
          return {
            ...game,
            move2: move2 || 0,
          }
        }
        return game;
      }) || [];
      setGames(newGames);
      localStorage.setItem('games', JSON.stringify(newGames));
      setCurrentGame(newGames.find(game => game.address === gameContract) as Game);
      setMessage('Successfully played your move. Waiting for the other player to reveal the move.');
    } catch (error) {
      console.error(error);
      setMessage('Failed to join the game.');
    } finally {
      setLoading(false);
    }
  };

  const revealMove = async () => {
    try {
      if (!blockchainService || !currentGame) return;
      setLoading(true);
      await blockchainService.revealMove(`${currentGame.move1}`, (`${currentGame.salt}`) as string);
      setMessage('Move revealed successfully.');
    } catch (error) {
      console.error(error);
      setMessage('Failed to reveal the move.');
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      const accounts = await sdk?.connect();
      setAccount((accounts as any)?.[0]);
      const urlParams = new URLSearchParams(window.location.search);
      const address = urlParams.get('game');
      if (address) {
        setOtherContract(address);

        setTimeout(() => {
          joinAnotherGame(address);
        }, 1000)
      }
    } catch (err) {
        console.warn("failed to connect..", err);
    }
  }

  const joinAnotherGame = async (address: string = '') => {
    try {
      const gameAddress = otherContract || address;
      setLoading(true);
      if (!blockchainService) throw new Error('Blockchain service not initialized');
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      console.log(otherContract);
      blockchainService.setContractAddress(gameAddress, signer);
      const player1 = (await blockchainService.getFirstPlayer()).toLowerCase();
      const player2 = (await blockchainService.getSecondPlayer()).toLowerCase();
      const stake = Number(ethers.formatEther(await blockchainService.getStake())).toString();
      setStake(Number(stake));
      const move2 = await blockchainService.player2Move();

      if (games?.find(game => game.address === gameAddress)) return;
      const newGames = [...(games || []), {
        address: gameAddress,
        player1: player1,
        player2: player2,
        stake,
        move1: 0,
        move2:  move2 || 0,
        winner: '',
        salt: null
      }]
      setGames(newGames);
      localStorage.setItem('games', JSON.stringify(newGames));
      setCurrentGame(newGames.find(game => game.address === gameAddress) as Game);
      setMessage('Successfully joined the game.');
    }
    catch (error) {
      console.error(error);
      setMessage('Failed to join the game.');
    } finally {
      setLoading(false);
    }
  }

  const timeOutMove = async () => {
    if (!blockchainService || !currentGame) return;
    try {
      setLoading(true);
      if (currentGame.player1 === account) {
        await blockchainService.timeOutPlayer2();
      }
      if (currentGame.player2 === account) {
        await blockchainService.timeOutPlayer1();
      }
      const stake = Number(ethers.formatEther(await blockchainService.getStake())).toString();
      setStake(Number(stake));

      const newGames = games?.map(game => {
        if (game.address === currentGame.address) {
          return {
            ...game,
            stake,
          }
        }
        return game;
      }) || [];
      setGames(newGames);
      localStorage.setItem('games', JSON.stringify(newGames));
      setCurrentGame(newGames.find(game => game.address === currentGame.address) as Game);
      setMessage('Move timed out successfully.');
    } catch (error) {
      console.error(error);
      setMessage('Timeout not passed yet.');
    } finally {
      setLoading(false);
    }
  }

  const selectGame = async (game: Game) => {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    if (!blockchainService) throw new Error('Blockchain service not initialized');
    blockchainService.setContractAddress(game.address, signer);
    const move2 = await blockchainService.player2Move();
    const stake = Number(ethers.formatEther(await blockchainService.getStake())).toString();
    setStake(Number(stake));

    const newGames = games?.map(g => {
      if (g.address === game.address) {
        return {
          ...g,
          move2: move2 || 0,
          stake,
        }
      }
      return g;
    }) || [];
    setGames(newGames);
    localStorage.setItem('games', JSON.stringify(newGames));
    game.move2 = move2 || 0;
    game.stake = stake;
    setCurrentGame(game);
  }

  const refreshGame = async () => {
    if (!blockchainService || !currentGame) return;
    try {
      setLoading(true);
      const move2 = await blockchainService.player2Move();
      const stake = Number(ethers.formatEther(await blockchainService.getStake())).toString();
      setStake(Number(stake));

      const newGames = games?.map(game => {
        if (game.address === currentGame.address) {
          return {
            ...game,
            move2: move2 || 0,
            stake,
          }
        }
        return game;
      }) || [];
      setGames(newGames);
      localStorage.setItem('games', JSON.stringify(newGames));
      setCurrentGame(newGames.find(game => game.address === currentGame.address) as Game);
      setMessage('Game refreshed successfully.');
    } catch (error) {
      console.error(error);
      setMessage('Failed to refresh the game.');
    } finally {
      setLoading(false);
    }
  }

  const removeGame = async (game: Game) => {
    const newGames = games?.filter(g => g.address !== game.address) || [];
    setGames(newGames);
    localStorage.setItem('games', JSON.stringify(newGames));
    if (currentGame?.address === game.address) {
      setCurrentGame(null);
    }
  }

  const clearGame = async () => {
    setCurrentGame(null);
  }

  const switchNetwork = async () => {
    try {
      if (provider) {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: supportedChainId}],
        });
      }
    } catch (err) {
      console.warn("failed to switch network..", err);
    }
  }

  const shareGame = async (game: Game) => {
    // copy to clipboard current url with game address as query param
    const url = new URL(window.location.href);
    url.searchParams.set('game', game.address);
    navigator.clipboard.writeText(url.href);
    setMessage('Game address copied to clipboard.');
  }

  return (
    <Container>
      <h1>Rock Paper Scissors, Spock, Lizard Game</h1>
      {message && account && <Alert variant="info">{message}</Alert>}
      {account && chainId === supportedChainId && (
        <Form>
          <p>Connected as: {account}</p>
          
          {currentGame && (
            <div>
              <p>Game Connected: {currentGame.address}</p>
              <p>Player 1: {currentGame.player1 === account ? 'You' : currentGame.player1 }</p>
              <p>Player 2: {currentGame.player2 === account ? 'You' : currentGame.player2 }</p>
              {currentGame.stake !== '0' && <p>Bet Amount: {currentGame.stake}ETH</p>}
              {currentGame.winner && <p>Winner: {currentGame.winner}</p>}
              {currentGame.move1 !== 0 && <p>Move You played: {Moves[currentGame.move1]}</p>}
              <br />
              {currentGame.player1 === account && (
                <div>
                  {currentGame.move2 !== 0 && <p>Move Other played: {Moves[currentGame.move2]}</p>}
                  <br />
                  {currentGame.move2 !== 0 && currentGame.stake !== '0' && <Button disabled={loading} onClick={revealMove}>{loading ? 'Confirming Transaction' : 'Reveal Move'}</Button>}
                  {currentGame.move2 === 0 && <p>Waiting for the other player to play his move</p>}
                  {currentGame.move2 === 0 && currentGame.stake !== '0' && <Button onClick={timeOutMove}>Timeout Move</Button>}
                  {currentGame.stake !== '0' && <Button disabled={loading} onClick={refreshGame}>{loading ? 'Confirming Transaction' : 'Refresh Game'}</Button>}
                  {currentGame.stake === '0' && <p>Game Ended</p>}
                </div>
              )}
              {currentGame.player2 === account && (
                <div>
                  {currentGame.move1 !== 0 && <p>Move Player 1 played: {Moves[currentGame.move1] || 'Hidden'}</p>}
                  {currentGame.move2 !== 0 && currentGame.stake !== '0' && (
                    <div>
                      <p>Move You played: {Moves[currentGame.move2]}</p>
                      {currentGame.stake !== '0' && <Button disabled={loading} onClick={timeOutMove}>{loading ? 'Confirming Transaction' : 'Timeout Move'}</Button>}
                    </div>
                  )}
                  {currentGame.stake === '0' && <p>Game Ended</p>}
                  {currentGame.stake !== '0' && <Button onClick={refreshGame}>Refresh Game</Button>}
                  {currentGame.move2 === 0 && (
                    <Form.Group>
                      <Form.Label>Move</Form.Label>
                      <Form.Control as="select" value={move} onChange={(e) => setMove(e.target.value)}>
                        <option value="1">Rock</option>
                        <option value="2">Paper</option>
                        <option value="3">Scissors</option>
                        <option value="4">Spock</option>
                        <option value="5">Lizard</option>
                      </Form.Control>
                      <Form.Label>Stake (ETH: {ethBalance.toString()})</Form.Label>
                      <Form.Control type="number" value={stake} disabled />
                      <Button disabled={loading} onClick={playMove}>{loading ? 'Confirming Transaction' : 'Submit Your Move'}</Button>
                    </Form.Group>
                  )}
                  
                </div>
              )}
              <br />
              <br />
              <Button disabled={loading} onClick={clearGame}>{loading ? 'Confirming Transaction' : 'Play Another Game'}</Button>
              <br />
              <br />
            </div>
          )}

          {!currentGame && connected && (
            <Container>
              <Form.Group>
                <Form.Label>Game Contract Address</Form.Label>
                <Form.Control type="text" value={otherContract} onChange={(e) => setOtherContract(e.target.value)} />
              </Form.Group>
              <br />
              <Button disabled={loading} variant="primary" onClick={() => joinAnotherGame('')}>{loading ? 'Confirming Transaction' : 'Join Game'}</Button>
              <br />
              <br />
              <p>OR Start a new Game with someone</p>
              <br />
              <br />
              <Form.Group>
                <Form.Label>Second Player Address</Form.Label>
                <Form.Control type="text" value={player} onChange={(e) => setPlayer(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Move</Form.Label>
                <Form.Control as="select" value={move} onChange={(e) => setMove(e.target.value)}>
                  <option value="1">Rock</option>
                  <option value="2">Paper</option>
                  <option value="3">Scissors</option>
                  <option value="4">Spock</option>
                  <option value="5">Lizard</option>
                </Form.Control>
              </Form.Group>
              <Form.Group>
                <Form.Label>Stake (ETH: { ethBalance })</Form.Label>
                <Form.Control type="number" min={0.0001} max={ethBalance.toString()} value={stake} onChange={(e) => setStake(Number(e.target.value))} />
              </Form.Group>
              <br />
              <Button disabled={loading} variant="primary" onClick={createGame}>{loading ? 'Confirming Transaction' : 'Create Game'}</Button>
            </Container>
          )}

          {games && games.length > 0 && (
            <Container>
              <h2>All Your Games</h2>
              <Row>
              {games.map((game) => (
                <Col key={game.address} className={"game-card"}>
                  <p>Game: {game.address}</p>
                  <p>Player 1: {game.player1 === account ? 'You' : game.player1 }</p>
                  <p>Player 2: {game.player2 === account ? 'You' : game.player2}</p>
                  {game.stake !== '0' && <p>Bet Amount: {game.stake}</p>}
                  <br />
                  <Row>
                  {game.stake !== '0' && <Col>
                  <Button onClick={() => selectGame(game)}>Select Game</Button>
                    </Col>}
                    <Col>
                      <Button onClick={() => removeGame(game)}>Remove Game</Button>
                    </Col>
                    <Col>
                      <Button onClick={() => shareGame(game)}>Share Game</Button>
                    </Col>
                  </Row>
                </Col>
              ))}
              </Row>
            </Container>
          )}
        </Form>
      )}
      {!account &&
        <Button variant="primary" onClick={connectWallet}>Connect Wallet</Button>
      }
      {account && chainId !== supportedChainId &&
        <Container>
          <p>Wrong network. Switch To Sepolia Testnet</p>
          <br />
          <br />
          <Button variant="primary" onClick={switchNetwork}>Switch Network</Button>

        </Container>
      }
    </Container>
  );
}

export default App;
