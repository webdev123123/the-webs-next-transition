import express from 'express'
import bodyParser from 'body-parser'
import * as db from './db.js'

const app = express()

app.use(express.static('public'))
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

export function incompleteIcon() {
	return /* html */ `
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="40"
			height="40"
			viewBox="-3 -3 105 105"
		>
			<circle
				cx="50"
				cy="50"
				r="50"
				fill="none"
				stroke="#ededed"
				strokeWidth="3"
			></circle>
		</svg>
	`
}

export function completeIcon() {
	return /* html */ `
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="40"
			height="40"
			viewBox="-3 -3 105 105"
		>
			<circle
				cx="50"
				cy="50"
				r="50"
				fill="none"
				stroke="#bddad5"
				strokeWidth="3"
			></circle>
			<path fill="#5dc2af" d="M72 25L42 71 27 56l-4 4 20 20 34-52z"></path>
		</svg>
	`
}

function renderListItem({ id, title, complete }) {
	return /* html */ `
		<li class="${complete ? 'completed' : ''}">
			<div class="view">
				<form method="post">
					<input type="hidden" name="todoId" value="${id}" />
					<input type="hidden" name="complete" value="${!complete}" />
					<button
						type="submit"
						name="intent"
						value="toggleTodo"
						class="toggle"
						title="${complete ? 'Mark as incomplete' : 'Mark as complete'}"
					>
						${complete ? completeIcon() : incompleteIcon()}
					</button>
				</form>
				<form method="post" class="update-form">
					<input type="hidden" name="intent" value="updateTodo" />
					<input type="hidden" name="todoId" value="${id}" />
					<input name="title" class="edit-input" value="${title}" />
				</form>
				<form method="post">
					<input type="hidden" name="todoId" value="${id}" />
					<button
						class="destroy"
						title="Delete todo"
						type="submit"
						name="intent"
						value="deleteTodo"
					></button>
				</form>
			</div>
		</li>
	`
}

async function handleFormPost(req, res) {
	const { todoId, intent, complete, title } = req.body
	switch (intent) {
		case 'createTodo': {
			await db.createTodo({ title })
			break
		}
		case 'toggleAllTodos': {
			await db.updateAll({ complete: complete === 'true' })
			break
		}
		case 'deleteCompletedTodos': {
			await db.deleteComplete()
			break
		}
		case 'toggleTodo': {
			await db.updateTodo(todoId, {
				complete: complete === 'true',
			})
			break
		}
		case 'updateTodo': {
			await db.updateTodo(todoId, {
				title,
			})
			break
		}
		case 'deleteTodo': {
			await db.deleteTodo(todoId)
			break
		}
		default: {
			console.warn('Unhandled intent', intent)
			break
		}
	}

	res.redirect(req.url)
}

async function renderApp(req, res) {
	const todos = await db.getTodos()
	const hasCompleteTodos = todos.some(todo => todo.complete === true)

	const filter = req.url.includes('/complete')
		? 'complete'
		: req.url.includes('/active')
		? 'active'
		: 'all'

	const remainingActive = todos.filter(t => !t.complete)
	const allComplete = remainingActive.length === 0

	res.send(/* html */ `
		<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<title>PEMPA TodoMVC</title>
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<link rel="stylesheet" href="/todos.css" />
			</head>
			<body>
				<section class="todoapp" data-active-filter="${filter}">
					<div>
						<header class="header">
							<h1>todos</h1>
							<form method="post" class="create-form">
								<input type="hidden" name="intent" value="createTodo" />
								<input
									class="new-todo"
									placeholder="What needs to be done?"
									title="New todo title"
									name="title"
									autofocus
								/>
							</form>
						</header>
						<section class="main ${todos.length ? '' : 'no-todos'}">
							<form method="post">
								<input type="hidden" name="complete" value="${!allComplete}" />
								<button
									class="toggle-all ${allComplete ? 'checked' : ''}"
									type="submit"
									name="intent"
									value="toggleAllTodos"
									title="${allComplete ? 'Mark all as incomplete' : 'Mark all as complete'}"
								>
									❯
								</button>
							</form>
							<ul class="todo-list" ${todos.length ? '' : 'hidden'}>
								${todos.map(todo => renderListItem(todo)).join('\n')}
							</ul>
						</section>
						<footer class="footer" ${todos.length ? '' : 'hidden'}>
							<span class="todo-count">
								<strong>${remainingActive.length}</strong>
								<span>
									${remainingActive.length === 1 ? 'item' : 'items'} left
								</span>
							</span>
							<ul class="filters">
								<li>
									<a data-filter="all" href="/todos">All</a>
								</li>
								<li>
									<a data-filter="active" href="/todos/active">Active</a>
								</li>
								<li>
									<a data-filter="complete" href="/todos/complete">Completed</a>
								</li>
							</ul>
							${
								hasCompleteTodos
									? /* html */ `
										<form method="post">
											<input
												type="hidden"
												name="intent"
												value="deleteCompletedTodos"
											/>
											<button class="clear-completed">Clear completed</button>
										</form>
								  `
									: ''
							}
						</footer>
					</div>
				</section>
				<footer class="info">
					<p>
						Created by <a href="http://github.com/kentcdodds">Kent C. Dodds</a>
					</p>
				</footer>
				<script src="/jquery.min.js"></script>
				<script src="/todos.js" type="module"></script>
			</body>
		</html>
	`)
}

app.get('/todos', renderApp)
app.get('/todos/:filter', renderApp)
app.post('/todos', handleFormPost)
app.post('/todos/:filter', handleFormPost)

app.put('/api/todos', async (req, res) => {
	const todos = await db.updateAll({
		title: req.body.title,
		complete: req.body.complete,
	})
	res.json({ todos })
})

app.delete('/api/todos', async (req, res) => {
	await db.deleteComplete()
	res.json({ todos: await db.getTodos() })
})

app.get('/api/todos/:id', async (req, res) => {
	const todo = await db.getTodo(req.params.id)
	res.json({ todo })
})

app.post('/api/todos', async (req, res) => {
	const todo = await db.createTodo({
		title: req.body.title,
		complete: req.body.complete,
	})
	res.json({ todo })
})

app.put('/api/todos/:id', async (req, res) => {
	const todo = await db.updateTodo(req.params.id, {
		title: req.body.title,
		complete: req.body.complete,
	})
	res.json({ todo })
})

app.delete('/api/todos/:id', async (req, res) => {
	await db.deleteTodo(req.params.id)
	res.json({ success: true })
})

app.get('*', (req, res) => res.redirect('/todos'))

const server = app.listen(process.env.PORT || 3000, () => {
	console.log(`Server running at http://localhost:${server.address().port}`)
})
