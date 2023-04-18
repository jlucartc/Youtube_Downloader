let connection = chrome.runtime.connect({name: 'popup'})
let search_input = document.querySelector('.search-group__input')
let file_format_select = document.querySelector('.format-filter__select')

search_input.addEventListener('keyup',filter_files)
file_format_select.addEventListener('change',filter_files)

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
    let videos = Object.keys(files).reverse()

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
    chrome.storage.local.get(['files','requests','blobs'],(data) => {
        delete data['files'][file_signature]
        delete data['requests'][file_signature]
        delete data['blobs'][file_signature]
        chrome.storage.local.set({files: data['files'], requests: data['requests'], blobs: data['blobs']})
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