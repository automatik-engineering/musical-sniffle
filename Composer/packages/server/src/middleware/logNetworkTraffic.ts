// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { NextFunction, Request, Response } from 'express';
import { ConversationNetworkErrorItem, ConversationNetworkTrafficItem } from '@botframework-composer/types';
import { v4 as uuid } from 'uuid';

import { WebSocketServer } from '../directline/utils/webSocketServer';

export function logNetworkTraffic(req: Request, res: Response, next?: NextFunction) {
  // hook into .send() so that it stores the data it sends on the response object
  const originalSend = res.send.bind(res);
  res.send = (data) => {
    (res as any).sentData = data;
    return originalSend(data);
  };

  // when the request finishes, log the payload and status code to the client
  res.once('finish', () => {
    let data: ConversationNetworkErrorItem | ConversationNetworkTrafficItem | undefined;
    let payload = (res as any).sentData;
    payload = typeof payload === 'string' ? JSON.parse(payload || '{}') : payload;
    if (res.statusCode >= 400) {
      // an error was sent to the client
      const { error = {} } = payload;
      data = {
        error: {
          details: error.details,
          message: error.message,
        },
        id: uuid(),
        request: { method: req.method, payload: req.body, route: req.originalUrl },
        response: {
          payload,
          statusCode: res.statusCode,
        },
        timestamp: Date.now(),
        trafficType: 'networkError',
      };
    } else {
      // a successful response was sent to the client
      data = {
        id: uuid(),
        request: { method: req.method, payload: req.body, route: req.originalUrl },
        response: {
          payload,
          statusCode: res.statusCode,
        },
        timestamp: Date.now(),
        trafficType: 'network',
      };
    }
    WebSocketServer.sendTrafficToSubscribers(data);
  });
  next?.();
}
