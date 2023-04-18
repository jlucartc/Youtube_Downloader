let connection = chrome.runtime.connect({name: 'content'})
let current_url = window.location.href
connection.postMessage({msg: 'youtube_tab', video_url: current_url})