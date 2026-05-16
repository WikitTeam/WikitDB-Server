const DEFAULT_GQL_ENDPOINT = 'https://wikit.unitreaty.org/apiv1/graphql';

function getGraphQLEndpoint(wikiConfig) {
    return (wikiConfig && wikiConfig.GQL_API) || DEFAULT_GQL_ENDPOINT;
}

module.exports = { DEFAULT_GQL_ENDPOINT, getGraphQLEndpoint };
