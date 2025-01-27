import { mock, mockReset } from 'jest-mock-extended';
import { nanoid } from 'nanoid';
import { Socket } from 'socket.io';
import * as TestUtils from '../client/TestUtils';
import { UserLocation } from '../CoveyTypes';
import { townSubscriptionHandler } from '../requestHandlers/CoveyTownRequestHandlers';
import CoveyTownListener from '../types/CoveyTownListener';
import GlobalChatMessage from '../types/GlobalChatMessage';
import Player from '../types/Player';
import PlayerSession from '../types/PlayerSession';
import PrivateChatMessage from '../types/PrivateChatMessage';
import CoveyTownController from './CoveyTownController';
import CoveyTownsStore from './CoveyTownsStore';
import TwilioVideo from './TwilioVideo';

jest.mock('./TwilioVideo');

const mockGetTokenForTown = jest.fn();
// eslint-disable-next-line
// @ts-ignore it's a mock
TwilioVideo.getInstance = () => ({
  getTokenForTown: mockGetTokenForTown,
});

function generateTestLocation(): UserLocation {
  return {
    rotation: 'back',
    moving: Math.random() < 0.5,
    x: Math.floor(Math.random() * 100),
    y: Math.floor(Math.random() * 100),
  };
}

describe('CoveyTownController', () => {
  beforeEach(() => {
    mockGetTokenForTown.mockClear();
  });
  it('constructor should set the friendlyName property', () => {
    // Included in handout
    const townName = `FriendlyNameTest-${nanoid()}`;
    const townController = new CoveyTownController(townName, false);
    expect(townController.friendlyName).toBe(townName);
  });
  describe('addPlayer', () => {
    // Included in handout
    it('should use the coveyTownID and player ID properties when requesting a video token', async () => {
      const townName = `FriendlyNameTest-${nanoid()}`;
      const townController = new CoveyTownController(townName, false);
      const newPlayerSession = await townController.addPlayer(new Player(nanoid()));
      expect(mockGetTokenForTown).toBeCalledTimes(1);
      expect(mockGetTokenForTown).toBeCalledWith(
        townController.coveyTownID,
        newPlayerSession.player.id,
      );
    });
  });
  describe('town listeners and events', () => {
    let testingTown: CoveyTownController;
    let otherTown: CoveyTownController;
    const mockListeners = [
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
      mock<CoveyTownListener>(),
    ];
    beforeEach(() => {
      const townName = `town listeners and events tests ${nanoid()}`;
      const otherTownName = `a second town to test that chats stay within towns ${nanoid()}`;
      testingTown = new CoveyTownController(townName, false);
      otherTown = new CoveyTownController(otherTownName, false);
      mockListeners.forEach(mockReset);
    });
    it('should notify added listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);
      const newLocation = generateTestLocation();
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.updatePlayerLocation(player, newLocation);
      mockListeners.forEach(listener => expect(listener.onPlayerMoved).toBeCalledWith(player));
    });
    it('should notify added listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.destroySession(session);
      mockListeners.forEach(listener =>
        expect(listener.onPlayerDisconnected).toBeCalledWith(player),
      );
    });
    it('should notify added listeners of new players when addPlayer is called', async () => {
      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      const player = new Player('test player');
      await testingTown.addPlayer(player);
      mockListeners.forEach(listener => expect(listener.onPlayerJoined).toBeCalledWith(player));
    });
    it('should notify added listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.disconnectAllPlayers();
      mockListeners.forEach(listener => expect(listener.onTownDestroyed).toBeCalled());
    });
    it('should not notify removed listeners of player movement when updatePlayerLocation is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const newLocation = generateTestLocation();
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.updatePlayerLocation(player, newLocation);
      expect(listenerRemoved.onPlayerMoved).not.toBeCalled();
    });
    it('should not notify removed listeners of player disconnections when destroySession is called', async () => {
      const player = new Player('test player');
      const session = await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerDisconnected).not.toBeCalled();
    });
    it('should not notify removed listeners of new players when addPlayer is called', async () => {
      const player = new Player('test player');

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      const session = await testingTown.addPlayer(player);
      testingTown.destroySession(session);
      expect(listenerRemoved.onPlayerJoined).not.toBeCalled();
    });

    it('should not notify removed listeners that the town is destroyed when disconnectAllPlayers is called', async () => {
      const player = new Player('test player');
      await testingTown.addPlayer(player);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      const listenerRemoved = mockListeners[1];
      testingTown.removeTownListener(listenerRemoved);
      testingTown.disconnectAllPlayers();
      expect(listenerRemoved.onTownDestroyed).not.toBeCalled();
    });

    it('should send a private message', async () => {
      const player1 = new Player('player 1');
      const player2 = new Player('player 2');

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);
      mockListeners.forEach(listener => testingTown.addTownListener(listener));
      testingTown.sendPrivatePlayerMessage(player1.id, player2.id, 'hello');
      expect(testingTown.players.length).toBe(2);
      expect(testingTown.messages.length).toBe(1);
      expect(testingTown.messages[0].message).toBe('hello');
      expect(testingTown.messages[0].senderID).toBe(player1.id);
    });

    it('should send a global message', async () => {
      const player1 = new Player('player 1');
      const player2 = new Player('player 2');
      const player3 = new Player('player 3');

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);
      await testingTown.addPlayer(player3);

      mockListeners.forEach(listener => testingTown.addTownListener(listener));

      expect(testingTown.players.length).toBe(3);

      testingTown.sendGlobalPlayerMessage(player1.id, 'hello');

      const message = new GlobalChatMessage('hello', player1.id);

      expect(testingTown.messages.length).toBe(1);
      expect(testingTown.messages[0].message).toBe('hello');
      expect(testingTown.messages[0].senderID).toBe(player1.id);

      expect(mockListeners[0].onGlobalMessage).toBeCalledWith(message);
      expect(mockListeners[1].onGlobalMessage).toBeCalledWith(message);
      expect(mockListeners[2].onGlobalMessage).toBeCalledWith(message);
    });

    it('players in other rooms do not get a global message from the current room', async () => {
      const player1 = new Player('player 1');
      const player2 = new Player('player 2');

      await testingTown.addPlayer(player1);
      await otherTown.addPlayer(player2);
      const message = new GlobalChatMessage('Road works ahead', player1.id);
      const otherTownMessage = new GlobalChatMessage('I sure hope it does', player2.id);

      testingTown.sendGlobalPlayerMessage(message.senderID, message.message);
      otherTown.sendGlobalPlayerMessage(otherTownMessage.senderID, otherTownMessage.message);
      expect(testingTown.messages).toEqual(expect.arrayContaining([message]));
      expect(testingTown.messages).toEqual(expect.not.arrayContaining([otherTownMessage]));
      expect(otherTown.messages).toEqual(expect.arrayContaining([otherTownMessage]));
      expect(otherTown.messages).toEqual(expect.not.arrayContaining([message]));
    });

    it('players in other rooms do not get a private message from the current room', async () => {
      const player1 = new Player('player 1');
      const player2 = new Player('player 2');
      const player3 = new Player('player 3');
      const player4 = new Player('player 4');

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);
      await otherTown.addPlayer(player3);
      await otherTown.addPlayer(player4);
      const message = new PrivateChatMessage('Road works ahead', player1.id, player2.id);
      const otherTownMessage = new PrivateChatMessage('I sure hope it does', player3.id, player4.id);

      testingTown.sendPrivatePlayerMessage(message.senderID, message.getReceiverID(), message.message);
      otherTown.sendPrivatePlayerMessage(otherTownMessage.senderID, otherTownMessage.getReceiverID(), otherTownMessage.message);
      expect(testingTown.messages).toEqual(expect.arrayContaining([message]));
      expect(testingTown.messages).toEqual(expect.not.arrayContaining([otherTownMessage]));
      expect(otherTown.messages).toEqual(expect.arrayContaining([otherTownMessage]));
      expect(otherTown.messages).toEqual(expect.not.arrayContaining([message]));
    });

    it('global messages should be censored appropriately', async () => {
      const player1 = new Player('player 1');
      const player1ID = player1.id;

      await testingTown.addPlayer(player1);
      const message1 = new GlobalChatMessage('professor bell icecream', player1ID);
      const censoredMessage1 = new GlobalChatMessage('professor **** icecream', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message1.message);
      const message2 = new GlobalChatMessage('bell', player1ID);
      const censoredMessage2 = new GlobalChatMessage('****', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message2.message);
      const message3 = new GlobalChatMessage('professor boyland', player1ID);
      const censoredMessage3 = new GlobalChatMessage('professor boyland', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message3.message);
      const message4 = new GlobalChatMessage('professor bell bell boyland', player1ID);
      const censoredMessage4 = new GlobalChatMessage('professor **** **** boyland', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message4.message);
      expect(testingTown.messages).toEqual(expect.arrayContaining([censoredMessage1]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([censoredMessage2]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([censoredMessage3]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([censoredMessage4]));
    });

    it('private messages should be censored appropriately', async () => {
      const player1 = new Player('player 1');
      const player2 = new Player('player 2');
      const player1ID = player1.id;
      const player2ID = player2.id;

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);
      const message1 = new PrivateChatMessage('professor bell icecream', player1ID, player2ID);
      const censoredMessage1 = new PrivateChatMessage('professor **** icecream', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message1.message);
      const message2 = new PrivateChatMessage('bell', player1ID, player2ID);
      const censoredMessage2 = new PrivateChatMessage('****', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message2.message);
      const message3 = new PrivateChatMessage('professor boyland', player1ID, player2ID);
      const censoredMessage3 = new PrivateChatMessage('professor boyland', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message3.message);
      const message4 = new PrivateChatMessage('professor bell bell boyland', player1ID, player2ID);
      const censoredMessage4 = new PrivateChatMessage('professor **** **** boyland', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message4.message);
      expect(testingTown.messages).toEqual(expect.arrayContaining([censoredMessage1]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([censoredMessage2]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([censoredMessage3]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([censoredMessage4]));
    });

    it('global messages should send emojis when appropriate', async () => {
      const player1 = new Player('player 1');
      const player1ID = player1.id;

      await testingTown.addPlayer(player1);
      const message1 = new GlobalChatMessage('howdy', player1ID);
      const emojifiedMessage1 = new GlobalChatMessage('howdy', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message1.message);
      const message2 = new GlobalChatMessage('howdy :face_with_cowboy_hat: partner', player1ID);
      const emojifiedMessage2 = new GlobalChatMessage('howdy 🤠 partner', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message2.message);
      const message3 = new GlobalChatMessage('howdy :face_with_cowboy_hat partner', player1ID);
      const emojifiedMessage3 = new GlobalChatMessage('howdy :face_with_cowboy_hat partner', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message3.message);
      const message4 = new GlobalChatMessage(':face_with_cowboy_hat:', player1ID);
      const emojifiedMessage4 = new GlobalChatMessage('🤠', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message4.message);
      const message5 = new GlobalChatMessage(':fae_with_cowboy_hat:', player1ID);
      const emojifiedMessage5 = new GlobalChatMessage(':fae_with_cowboy_hat:', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message5.message);
      const message6 = new GlobalChatMessage('hey howdy hey :face_with_cowboy_hat: :face_with_cowboy_hat: my names Woody', player1ID);
      const emojifiedMessage6 = new GlobalChatMessage('hey howdy hey 🤠 🤠 my names Woody', player1ID);
      testingTown.sendGlobalPlayerMessage(player1ID, message6.message);
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage1]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage2]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage3]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage4]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage5]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage6]));
    });

    it('private messages should send emojis when appropriate', async () => {
      const player1 = new Player('player 1');
      const player2 = new Player('player 2');
      const player1ID = player1.id;
      const player2ID = player2.id;

      await testingTown.addPlayer(player1);
      await testingTown.addPlayer(player2);
      const message1 = new PrivateChatMessage('howdy', player1ID, player2ID);
      const emojifiedMessage1 = new PrivateChatMessage('howdy', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message1.message);
      const message2 = new PrivateChatMessage('howdy :face_with_cowboy_hat: partner', player1ID, player2ID);
      const emojifiedMessage2 = new PrivateChatMessage('howdy 🤠 partner', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message2.message);
      const message3 = new PrivateChatMessage('howdy :face_with_cowboy_hat partner', player1ID, player2ID);
      const emojifiedMessage3 = new PrivateChatMessage('howdy :face_with_cowboy_hat partner', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message3.message);
      const message4 = new PrivateChatMessage(':face_with_cowboy_hat:', player1ID, player2ID);
      const emojifiedMessage4 = new PrivateChatMessage('🤠', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message4.message);
      const message5 = new PrivateChatMessage(':fae_with_cowboy_hat:', player1ID, player2ID);
      const emojifiedMessage5 = new PrivateChatMessage(':fae_with_cowboy_hat:', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message5.message);
      const message6 = new PrivateChatMessage('hey howdy hey :face_with_cowboy_hat: :face_with_cowboy_hat: my names Woody', player1ID, player2ID);
      const emojifiedMessage6 = new PrivateChatMessage('hey howdy hey 🤠 🤠 my names Woody', player1ID, player2ID);
      testingTown.sendPrivatePlayerMessage(player1ID, player2ID, message6.message);
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage1]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage2]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage3]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage4]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage5]));
      expect(testingTown.messages).toEqual(expect.arrayContaining([emojifiedMessage6]));
    });
    
  });

  describe('townSubscriptionHandler', () => {
    const mockSocket = mock<Socket>();
    let testingTown: CoveyTownController;
    let player: Player;
    let session: PlayerSession;
    beforeEach(async () => {
      const townName = `connectPlayerSocket tests ${nanoid()}`;
      testingTown = CoveyTownsStore.getInstance().createTown(townName, false);
      mockReset(mockSocket);
      player = new Player('test player');
      session = await testingTown.addPlayer(player);
    });
    it('should reject connections with invalid town IDs by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(nanoid(), session.sessionToken, mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    it('should reject connections with invalid session tokens by calling disconnect', async () => {
      TestUtils.setSessionTokenAndTownID(testingTown.coveyTownID, nanoid(), mockSocket);
      townSubscriptionHandler(mockSocket);
      expect(mockSocket.disconnect).toBeCalledWith(true);
    });
    describe('with a valid session token', () => {
      it('should add a town listener, which should emit "newPlayer" to the socket when a player joins', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        await testingTown.addPlayer(player);
        expect(mockSocket.emit).toBeCalledWith('newPlayer', player);
      });
      it('should add a town listener, which should emit "playerMoved" to the socket when a player moves', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.updatePlayerLocation(player, generateTestLocation());
        expect(mockSocket.emit).toBeCalledWith('playerMoved', player);
      });
      it('should add a town listener, which should emit "playerDisconnect" to the socket when a player disconnects', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.destroySession(session);
        expect(mockSocket.emit).toBeCalledWith('playerDisconnect', player);
      });
      it('should add a town listener, which should emit "townClosing" to the socket and disconnect it when disconnectAllPlayers is called', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        testingTown.disconnectAllPlayers();
        expect(mockSocket.emit).toBeCalledWith('townClosing');
        expect(mockSocket.disconnect).toBeCalledWith(true);
      });
      describe('when a socket disconnect event is fired', () => {
        it('should remove the town listener for that socket, and stop sending events to it', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            const newPlayer = new Player('should not be notified');
            await testingTown.addPlayer(newPlayer);
            expect(mockSocket.emit).not.toHaveBeenCalledWith('newPlayer', newPlayer);
          } else {
            fail('No disconnect handler registered');
          }
        });
        it('should destroy the session corresponding to that socket', async () => {
          TestUtils.setSessionTokenAndTownID(
            testingTown.coveyTownID,
            session.sessionToken,
            mockSocket,
          );
          townSubscriptionHandler(mockSocket);

          // find the 'disconnect' event handler for the socket, which should have been registered after the socket was connected
          const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect');
          if (disconnectHandler && disconnectHandler[1]) {
            disconnectHandler[1]();
            mockReset(mockSocket);
            TestUtils.setSessionTokenAndTownID(
              testingTown.coveyTownID,
              session.sessionToken,
              mockSocket,
            );
            townSubscriptionHandler(mockSocket);
            expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
          } else {
            fail('No disconnect handler registered');
          }
        });
      });
      it('should forward playerMovement events from the socket to subscribed listeners', async () => {
        TestUtils.setSessionTokenAndTownID(
          testingTown.coveyTownID,
          session.sessionToken,
          mockSocket,
        );
        townSubscriptionHandler(mockSocket);
        const mockListener = mock<CoveyTownListener>();
        testingTown.addTownListener(mockListener);
        // find the 'playerMovement' event handler for the socket, which should have been registered after the socket was connected
        const playerMovementHandler = mockSocket.on.mock.calls.find(
          call => call[0] === 'playerMovement',
        );
        if (playerMovementHandler && playerMovementHandler[1]) {
          const newLocation = generateTestLocation();
          player.location = newLocation;
          playerMovementHandler[1](newLocation);
          expect(mockListener.onPlayerMoved).toHaveBeenCalledWith(player);
        } else {
          fail('No playerMovement handler registered');
        }
      });
    });
  });
});
