var pbUrl = 'https://api.pinboard.in/v1/posts/add?url=';
pbUrl += encodeURIComponent(engines[i].url);
pbUrl += '&description=';
pbUrl += encodeURIComponent(engines[i].name);
pbUrl += (engines[i].keyword)?encodeURIComponent('::' + engines[i].keyword):'';
pbUrl += '&tags=PopSearch&replace=yes&shared=no';
