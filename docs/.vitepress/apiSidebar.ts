import * as fs from 'fs'
import * as path from 'path'

interface DirectoryObject {
  text: string
  link: string
}

function formatDirectoryText(directoryName: string): string {
  const words = directoryName.split('-')
  const formattedWords = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
  return formattedWords.join('')
}

function getDirectories(startingPath: string, relativeToPath: string): DirectoryObject[] {
  const directories: DirectoryObject[] = []

  try {
    const files = fs.readdirSync(startingPath)
    files.forEach((file) => {
      const filePath = path.join(startingPath, file)
      const stats = fs.statSync(filePath)

      if (stats.isDirectory()) {
        const relativePath = path.relative(relativeToPath, filePath)
        const link = `/${relativePath}/` // Add a leading slash to the relative path
        directories.push({
          text: formatDirectoryText(file),
          link: link,
        })
      }
    })
  } catch (err) {
    console.error(`Error reading directories: ${err}`)
  }

  return directories
}

export const getApiSidebarItems = () => {
  const startingPath = path.join(process.cwd(), '/docs/api')
  const relativeToPath = path.join(process.cwd(), '/docs/')

  return getDirectories(startingPath, relativeToPath)
}
