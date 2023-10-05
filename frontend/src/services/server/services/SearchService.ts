/* generated using openapi-typescript-codegen -- do no edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { SearchResults } from '../models/SearchResults';

import type { CancelablePromise } from '../core/CancelablePromise';
import type { BaseHttpRequest } from '../core/BaseHttpRequest';

export class SearchService {

    constructor(public readonly httpRequest: BaseHttpRequest) {}

    /**
     * Search
     * @param query
     * @param limit
     * @returns SearchResults Successful Response
     * @throws ApiError
     */
    public search(
        query: string,
        limit: number = 10,
    ): CancelablePromise<SearchResults> {
        return this.httpRequest.request({
            method: 'GET',
            url: '/api/search/',
            query: {
                'query': query,
                'limit': limit,
            },
            errors: {
                422: `Validation Error`,
            },
        });
    }

}
