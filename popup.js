let connection = chrome.runtime.connect({name: 'popup'})
let search_input = document.querySelector('.search-group__input')
let file_format_select = document.querySelector('.format-filter__select')
let clear_files_button = document.querySelector('.clear_files')
let blobs = {}

search_input.addEventListener('keyup',filter_files)
file_format_select.addEventListener('change',filter_files)
clear_files_button.addEventListener('click',clear_files)

chrome.storage.local.get('files',(data) => {
    if(data.hasOwnProperty('files')){
        generate_files_list(data['files'])
    }
})

chrome.storage.onChanged.addListener((data,areaName) => {
    if(data.hasOwnProperty('files')){
        generate_files_list(data['files'].newValue)
    }
})

function clear_files(){
    connection.postMessage({msg: 'erase_data'})
    chrome.storage.local.set({files: {},requests: {},blobs: {}})
}

function filter_files(){
    let files = Array.from(document.querySelector('.files').children)
    let search_input = document.querySelector('.search-group__input')
    let file_format_select = document.querySelector('.format-filter__select')
    let words = search_input.value.split(/\s+/)

    files.forEach((file,index) => {
        let download_button = file.querySelector('.file-item-list-item__request-download , .file-item-list-item__download-complete')
        let signature = download_button.getAttribute('data-signature')
        if(words.length > 0){
            words.forEach((word) => {
                if(file.innerText.toLowerCase().match(word.toLowerCase() != null) || signature.match(file_format_select.value+'$') != null ){
                    file.style.display = 'flex'
                }else{
                    file.style.display = 'none'
                }
            })
        }else{
            if(signature.match(file_format_select.value+'$') != null ){
                file.style.display = 'flex'
            }else{
                file.style.display = 'none'
            }
        }
    })
}

function generate_files_list(files){
    let videos = Object.keys(files)

    let files_container = document.querySelector('.files')
    
    Array.from(files_container.children).forEach((child) => {
        files_container.removeChild(child)
    })

    videos.forEach((video) => {
        let file = files[video]

        let file_item = document.createElement('div')
        let file_item_list_item_url = document.createElement('a')
        let file_item_list_item_title = document.createElement('label')
        let file_item_list_item_download = document.createElement('button')
        let file_item_list_item_remove = document.createElement('button')
        
        file_item.append(file_item_list_item_url)
        file_item.append(file_item_list_item_title)
        file_item.append(file_item_list_item_download)
        file_item.append(file_item_list_item_remove)

        file_item.className = 'file-item'
        file_item_list_item_url.className = 'file-item-list-item__url'
        file_item_list_item_url.innerHTML = file.video_url
        file_item_list_item_url.href = file.video_url
        file_item_list_item_title.className = 'file-item-list-item__title'

        file_item_list_item_download.setAttribute('data-request',file.request_url)
        file_item_list_item_download.setAttribute('data-signature',video)
        file_item_list_item_download.setAttribute('data-video',file.video_url)
        file_item_list_item_download.setAttribute('data-mime',file.mime)
        file_item_list_item_download.innerHTML = 'Download '+file.mime

        file_item_list_item_remove.setAttribute('data-request',file.request_url)
        file_item_list_item_remove.setAttribute('data-signature',video)
        file_item_list_item_remove.setAttribute('data-video',file.video_url)
        file_item_list_item_remove.setAttribute('data-mime',file.mime)
        file_item_list_item_remove.innerHTML = 'Remove '+file.mime
        
        file_item_list_item_title.innerHTML = file.title
        
        if(file.file != null){
            file_item_list_item_download.className = 'file-item-list-item__download-complete'
            file_item_list_item_download.addEventListener('click',download_file)
            file_item_list_item_remove.className = 'file-item-list-item__remove'
            file_item_list_item_remove.addEventListener('click',remove_file)
        }else{
            if(file.in_progress){
                file_item_list_item_download.innerHTML = 'Downloading '+file.mime+'...'+'( '+file.progress+'% )'
                file_item_list_item_remove.disabled = true
                file_item_list_item_download.disabled = true
            }
            file_item_list_item_download.className = 'file-item-list-item__request-download'
            file_item_list_item_remove.className = 'file-item-list-item__remove'
            file_item_list_item_download.addEventListener('click',request_file_download)
            file_item_list_item_remove.addEventListener('click',remove_file)
        }

        files_container.append(file_item)
    })
}

function remove_file(e){
    let file_signature = e.target.getAttribute('data-signature')
    let request_url = e.target.getAttribute('data-request')
    let video_url = e.target.getAttribute('data-video')
    chrome.storage.local.get(['files','requests','blobs'],(data) => {
        connection.postMessage({msg: 'erase_file', request_url: request_url, video_url: video_url})
        delete data['files'][file_signature]
        delete data['requests'][file_signature]
        chrome.storage.local.set({files: data['files'], requests: data['requests']})
    })    
}

function get_signature(request_url,video_url){
    let itag_regex = /\&itag=[^&]+\&/
    let itag = request_url.match(itag_regex).pop()
    itag = itag.replace('&itag=','').replace('&','')
    return video_url+itag
}

function get_mime(request_url){
    let mime_regex = /\&mime=[^&]+\&/
    let mime = request_url.match(mime_regex).pop()
    mime = mime.replace('&mime=','').replace('&','').replace('%2F','/')
    return mime
}


function request_file_chunks(request_url,video_url,current_request_index){
    chrome.storage.local.get(['requests'])
    .then(data => {
        let requests = data['requests']
        let file_signature = get_signature(request_url,video_url)
        let total_requests = requests[file_signature].requests.length
        let mime = get_mime(request_url)
        let file_name = video_url+'.'+mime.split('/').pop()
        if(current_request_index <= total_requests-1){
            fetch(requests[file_signature].requests[current_request_index],{method: 'POST'})
            .then(data => data.blob())
            .then(data => {
                let reader = new FileReader()
                let blob_url = URL.createObjectURL(data)
                let blob_structure = {
                    data: [
                        {
                            content: blob_url,
                            id: current_request_index
                        }
                    ],
                    name: file_name,
                    mime: mime
                }
                if(blobs.hasOwnProperty(file_signature)){
                    blobs[file_signature].data.push({content: blob_url, id: current_request_index})
                }else{
                    blobs[file_signature] = blob_structure
                }
                chrome.storage.local.get('files')
                .then(storage => {
                    if(storage.hasOwnProperty('files')){
                        storage['files'][file_signature].progress = Math.trunc((blobs[file_signature].data.length/requests[file_signature].requests.length)*100)
                        chrome.storage.local.set({files: storage['files']})
                        .then(() => {
                            request_file_chunks(request_url,video_url,current_request_index+1)
                        })
                    }
                })
                reader.addEventListener('load',() => {
                })
                reader.readAsDataURL(data)
            })
        }else{
            chrome.storage.local.get(['files'])
            .then(data => {
                let file_name = blobs[file_signature].name
                let file_mime = blobs[file_signature].mime
                let sorted_data = blobs[file_signature]
                                  .data
                                  .sort((a,b) => {
                                        return a.id - b.id
                                  })
                                  .map((data) => {
                                        return data.content
                                  })
                let sorted_blobs = Promise.all(sorted_data.map((data,index) => {
                    return fetch(data.content)
                    .then(data => data.blob())
                }))
    
                sorted_blobs.then(result_blobs => {
                    let file = new File(result_blobs,file_name,{type: file_mime})
                    let reader = new FileReader()
                    reader.addEventListener('load',() => {
                        data['files'][file_signature].file = reader.result
                        chrome.storage.local.set({files: data['files']})
                        .then(() => {
                            chrome.action.getBadgeText({})
                            .then((text) => {
                                let new_text = ''
                                if(text != ''){
                                    new_text = (parseInt(text)+1).toString()
                                }else{
                                    new_text = '1'
                                }
                                chrome.action.setBadgeText({text: new_text})
                            })
                        })
                    })
                    reader.readAsDataURL(file)
                })
            })
        }
    })
}

function download_file(e){
    let file_signature = e.target.getAttribute('data-signature')
    chrome.storage.local.get(['files'],(data) => {
        let file = data['files'][file_signature]
        let link = document.createElement('a')
        link.style.display = 'none'
        link.href = file.file
        link.download = file.title
        document.body.append(link)
        link.click()
        document.body.removeChild(link)
    })
}

function request_file_download(e){
    e.target.disabled = true
    let signature = e.target.getAttribute('data-signature')
    let request_url = e.target.getAttribute('data-request')
    let video_url = e.target.getAttribute('data-video')
    let mime = e.target.getAttribute('data-mime')
    e.target.innerHTML = 'Downloading '+mime+'...'
    chrome.storage.local.get('files')
    .then(data => {
        if(data.hasOwnProperty('files')){
            data['files'][signature].in_progress = true
            chrome.storage.local.set({files: data['files']})
            .then(() => {
                connection.postMessage({msg: 'download_file', request_url: request_url, video_url: video_url})
            })
        }
    })
}