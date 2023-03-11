function change() {
	x = document.getElementById("social-tw")
	y = document.getElementById("social-li")
	z = document.getElementById("social-gh")
	if (x.style.display === "none") {
		x.style.display = "flex"
		y.style.display = "flex"
		z.style.display = "flex"
	} else {
		x.style.display = "none"
		y.style.display = "none"
		z.style.display = "none"
	}
}

let theme = localStorage.getItem('theme')

let themeDots = document.getElementsByClassName('theme-dot')

if (theme == null) {
	setTheme('blue')
} else {
	setTheme(theme)
}

for (var i = 0; themeDots.length > i; i++) {
	themeDots[i].addEventListener('click', function () {
		let mode = this.dataset.mode
		console.log('Option clicked:', mode)
		setTheme(mode)
	})
}

function setTheme(mode) {
	if (mode == 'light') {
		document.getElementById('theme-style').href = 'white.css'
	}

	if (mode == 'blue') {
		document.getElementById('theme-style').href = 'default.css'
	}

	if (mode == 'green') {
		document.getElementById('theme-style').href = 'green.css'
	}

	if (mode == 'purple') {
		document.getElementById('theme-style').href = 'purple.css'
	}

	localStorage.setItem('theme', mode)
}
