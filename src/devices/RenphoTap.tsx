import { Button, Stack, Typography } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'

interface ValueData {
  metricSystem: 'imperial' | 'decimal'
  decimalValue: string
  confirm: boolean
  mode: 'length' | 'circular'
  status: string
}

function useRenphoDevice() {
  const [value, setValue] = useState<ValueData>({
    confirm: false,
    decimalValue: '',
    metricSystem: 'decimal',
    mode: 'length',
    status: '',
  })

  const setStatus = useCallback((message: string) => {
    setValue({ ...value, status: message })
  }, [])

  const startScan = async () => {
    setStatus('Start BLE Scan...')
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        {
          name: 'ES-Tape',
        },
      ],
      optionalServices: [
        '0783B03E-8535-B5A0-7140-A304D2495CB7'.toLocaleLowerCase(),
      ],
    })

    const server = await device.gatt?.connect()
    setStatus('Device connected!')

    const primaryService = await server?.getPrimaryService(
      '0783B03E-8535-B5A0-7140-A304D2495CB7'.toLocaleLowerCase(),
    )

    const characteristic = await primaryService?.getCharacteristic(
      '0783B03E-8535-B5A0-7140-A304D2495CB8'.toLocaleLowerCase(),
    )

    const characteristicService = await characteristic?.startNotifications()

    setStatus('Receiving data...')

    characteristicService?.addEventListener(
      'characteristicvaluechanged',
      (e) => {
        setStatus('Receiving data...')

        const readValue = (e.target as any)?.value.buffer as ArrayBuffer
        const enc = new TextDecoder('utf-8')
        const decoded = enc.decode(readValue)

        const regexp =
          /\*(?<value>\d+);\d+;\d+(?<mode>1|0)(?<confirm>S|P)(?<metricSystem>I|M)/
        const data = regexp.exec(decoded)

        setValue({
          ...value,
          decimalValue: data?.groups?.value ?? '',
          confirm: data?.groups?.confirm === 'S',
          metricSystem:
            data?.groups?.metricSystem === 'I' ? 'imperial' : 'decimal',
          mode: data?.groups?.mode === '1' ? 'circular' : 'length',
        })
      },
    )
  }

  return { value, startScan }
}

function RenphoTap() {
  const { value, startScan } = useRenphoDevice()

  const [lastValueSaved, setLastValueSaved] = useState(false)

  const [log, setLog] = useState<number[]>([])

  const parsedValue = useMemo(() => {
    const cm = parseInt(value.decimalValue) / 100

    if (value.confirm) {
      if (!lastValueSaved) {
        setLastValueSaved(true)
        setLog((oldValues) => [...oldValues, cm])
      }
    } else {
      setLastValueSaved(false)
    }
    if (value.metricSystem === 'imperial') {
      return cm * 0.3937
    }

    return cm
  }, [value, lastValueSaved])

  return (
    <Stack>
      <Typography variant="h3">RENPHO Smart Tap Reader</Typography>
      <Typography variant="h4">
        {(parsedValue || 0).toFixed(2)}{' '}
        {value.metricSystem === 'decimal' ? 'cm' : 'in'} ({value.mode})
      </Typography>
      <Button variant="contained" onClick={startScan}>
        Start Scan
      </Button>

      <Typography>Status: {value.status}</Typography>

      {log.map((v) => {
        return <div>{v}</div>
      })}
    </Stack>
  )
}

export default RenphoTap
