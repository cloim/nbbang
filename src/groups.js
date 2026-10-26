// Group settings belong to the signed-in meeting owner and sync with the local API.
// Compatibility exports

export {
  cleanGroups as nbCleanGroups,
  loadGroups as nbLoadGroups,
  saveGroups as nbSaveGroups,
  groupNet as nbGroupNet,
} from './lib/groups'

export {
  GroupManager as nbGroupManager,
  PayerGroups as nbPayerGroups,
  GroupSummary as nbGroupSummary,
} from './components/GroupManager'
