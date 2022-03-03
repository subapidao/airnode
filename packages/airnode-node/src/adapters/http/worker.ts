import { logger, go, LogOptions } from '@api3/airnode-utilities';
import * as workers from '../../workers';
import { AggregatedApiCall, ApiCallResponse, LogsData, WorkerOptions, CallApiPayload } from '../../types';

export async function spawnNewApiCall(
  aggregatedApiCall: AggregatedApiCall,
  logOptions: LogOptions,
  workerOpts: WorkerOptions
): Promise<LogsData<ApiCallResponse | null>> {
  const options = {
    ...workerOpts,
    payload: { aggregatedApiCall, logOptions, functionName: 'callApi' } as CallApiPayload,
  };

  const [err, res] = await go(() => workers.spawn(options));
  if (err || !res) {
    const log = logger.pend('ERROR', `Unable to call API endpoint:${aggregatedApiCall.endpointName}`, err);
    return [[log], null];
  }

  if (!res.ok) {
    if (res.errorLog) {
      return [[res.errorLog], null];
    }
    const log = logger.pend('ERROR', `Unable to call API endpoint:${aggregatedApiCall.endpointName}`);
    return [[log], null];
  }
  return [[], res.data];
}
