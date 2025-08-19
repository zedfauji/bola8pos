import React, { useEffect, useRef } from 'react';
import { BarChart3, DollarSign } from 'lucide-react';

// Mock data for charts
const mockDailyData = [
  { hour: '9AM', amount: 120 },
  { hour: '10AM', amount: 180 },
  { hour: '11AM', amount: 150 },
  { hour: '12PM', amount: 210 },
  { hour: '1PM', amount: 240 },
  { hour: '2PM', amount: 190 },
  { hour: '3PM', amount: 160 },
];

const mockWeeklyData = [
  { day: 'Mon', amount: 850 },
  { day: 'Tue', amount: 750 },
  { day: 'Wed', amount: 920 },
  { day: 'Thu', amount: 1050 },
  { day: 'Fri', amount: 1250 },
  { day: 'Sat', amount: 1450 },
  { day: 'Sun', amount: 1100 },
];

const mockTypeData = [
  { type: 'Pool', amount: 2500 },
  { type: 'Billiards', amount: 1800 },
  { type: 'Snooker', amount: 1200 },
  { type: 'Carom', amount: 800 },
];

const RevenueChart = ({ period = 'daily' }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear previous chart
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set chart dimensions
    const chartWidth = canvas.width - 60;
    const chartHeight = canvas.height - 60;
    const startX = 40;
    const startY = 20;
    
    // Get data based on period
    let data;
    let labels;
    
    if (period === 'daily') {
      data = mockDailyData;
      labels = data.map(item => item.hour);
    } else if (period === 'weekly') {
      data = mockWeeklyData;
      labels = data.map(item => item.day);
    } else if (period === 'byType') {
      data = mockTypeData;
      labels = data.map(item => item.type);
    }
    
    // Find max value for scaling
    const maxValue = Math.max(...data.map(item => item.amount));
    const barWidth = chartWidth / data.length - 10;
    
    // Draw axes
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX, startY + chartHeight);
    ctx.lineTo(startX + chartWidth, startY + chartHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.stroke();
    
    // Draw bars
    data.forEach((item, index) => {
      const x = startX + (index * (barWidth + 10)) + 5;
      const barHeight = (item.amount / maxValue) * chartHeight;
      const y = startY + chartHeight - barHeight;
      
      // Draw bar
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(x, y, barWidth, barHeight);
      
      // Draw label
      ctx.fillStyle = '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[index], x + barWidth / 2, startY + chartHeight + 15);
      
      // Draw value
      ctx.fillStyle = '#1e293b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`$${item.amount}`, x + barWidth / 2, y - 5);
    });
    
  }, [period]);
  
  // If no canvas support, show fallback
  if (typeof window !== 'undefined' && !window.CanvasRenderingContext2D) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-md">
        <BarChart3 className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Chart visualization not supported
        </p>
      </div>
    );
  }
  
  return (
    <div className="w-full">
      <canvas 
        ref={canvasRef} 
        width={400} 
        height={200} 
        className="w-full h-auto"
      />
    </div>
  );
};

export default RevenueChart;
